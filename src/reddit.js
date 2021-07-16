const fetch = require('node-fetch')
const cheerio = require('cheerio')
const logger = require('@wizo06/logger')
const { writeFileSync, readFileSync } = require('fs')

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

;(async () => {
  while (true) {
    logger.info('Scraping...')

    const shows = readFileSync('config/shows.txt', { encoding: 'utf8' }).split('\n')

    const res = await fetch('https://old.reddit.com/user/autolovepon')
    const body = await res.text()
    const $ = cheerio.load(body)
    const posts = $('.thing')
  
    posts.each(async function () {
      const votes = $(this).find('.score.unvoted').text()
      const postTitle = $(this).find('.title.may-blank').text()
      // const postTime = $(this).find('.live-timestamp').text()
      const link = $(this).find('.thumbnail').attr('href')
      
      if (!postTitle.match(/ - Episode 1 discussion$/)) return
      // if (postTime.match(/^(0|1|2|3|4|5|6|7|8|9|10|11) hours ago$/)) return
      if (votes < 500) return logger.debug(`Skipping due to insufficient votes: ${votes}. ${postTitle}`)
      
      const res = await fetch(`https://old.reddit.com${link}`)
      const body = await res.text()
      const $$ = cheerio.load(body)
      const aTags = $$('.sitetable.linklisting').find('.md').find('a')
  
      aTags.each(async function () {
        const source = $(this).text()
        if (!source.match(/anilist/i)) return
        const anilistLink = $(this).attr('href')
        const anilistId = anilistLink.split('/')[4]
        const query = `query {
          Media(id: ${anilistId}) {
            title {
              romaji
            }
          }
        }`
        const res = await fetch('https://graphql.anilist.co/', { method: 'POST', body: JSON.stringify({query}), headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' } })
        const json = await res.json()

        if (json.errors) return console.log(json.errors)
        if (shows.includes(json.data?.Media?.title?.romaji)) return logger.debug(`Skipping due to duplicate. ${json.data?.Media?.title?.romaji}`)

        logger.info(`Appending ${json.data?.Media?.title?.romaji}`)
        writeFileSync('config/shows.txt', json.data?.Media?.title?.romaji + '\n', { flag: 'as' })

      })
    })

    await sleep(300000) // 5 minutes
  }
})()