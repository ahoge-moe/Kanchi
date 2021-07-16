const amqp = require('amqplib')
const fetch = require('node-fetch')
const logger = require('@wizo06/logger')
const parser = require('fast-xml-parser')
const { writeFileSync, readFileSync } = require('fs')
const { rabbitmq: { outbound } } = require('@iarna/toml').parse(readFileSync('config/config.toml'))

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

;(async () => {
  try {
    logger.info(`Connecting to RabbitMQ`)
    const connection = await amqp.connect(outbound)
    const channel = await connection.createChannel()
    logger.success(`Connection to RabbitMQ established`)
        
    logger.info(`Asserting outbound exchange`)
    await channel.assertExchange(outbound.exchange, 'direct')
    logger.success(`Outbound exchange asserted`)

    logger.info(`Asserting outbound queue`)
    await channel.assertQueue(outbound.queue)
    logger.success(`Outbound queue asserted`)

    logger.info(`Binding outbound exchange to outbound queue`)
    await channel.bindQueue(outbound.queue, outbound.exchange, outbound.routingKey)
    logger.success(`Binding established`)
    
    while (true) {
      logger.info(`Fetching rss`)
      const res = await fetch('https://subsplease.org/rss/?r=1080')
      const body = await res.text()
      const jsonObj = parser.parse(body)
      const items = jsonObj.rss?.channel?.item
  
      for (const item of items) {
        if (item.title.match(/\[Batch\]$/)) {
          logger.debug(`Skip batch: ${item.title}`)
          continue
        }
  
        if (history.includes(item.guid)) {
          logger.debug(`Skip old: ${item.title}`)
          continue
        }
    
        logger.info(`Publishing ${item.title}`)
        const data = {
          title: item.title,
          link: item.link,
          show: item.category.replace(/- 1080$/, '')
        }
    
        await channel.publish(
          outbound.exchange,
          outbound.routingKey,
          Buffer.from(JSON.stringify(data)),
          { persistent: true }
        )
  
        history.push(item.guid)
        writeFileSync('config/history.json', JSON.stringify(history))
      }

      await sleep(300000) // 5 minutes
    }
  }
  catch (e) {
    logger.error(e)
  }
})()