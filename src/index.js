const amqp = require('amqplib')
const fetch = require('node-fetch')
const logger = require('logger')
const parser = require('fast-xml-parser')
const { writeFileSync, readFileSync } = require('fs')
const { rabbitmq: { outbound }, rss: { url } } = require('@iarna/toml').parse(readFileSync('config/config.toml'))

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

;(async () => {
  try {
    logger.info(`Connecting to RabbitMQ`)
    const connection = await amqp.connect(outbound)
    const channel = await connection.createChannel()
    logger.success(`Connection to RabbitMQ established`, logger.color.green)
    
    await channel.prefetch(1)
    
    logger.info(`Asserting exchange`)
    await channel.assertExchange(outbound.exchange, 'direct')
    logger.success(`Exchange asserted`, logger.color.green)

    logger.info(`Asserting queue`)
    await channel.assertQueue(outbound.queue)
    logger.success(`Queue asserted`, logger.color.green)

    logger.info(`Binding exchange to queue`)
    await channel.bindQueue(outbound.queue, outbound.exchange, outbound.routingKey)
    logger.success(`Binding established`, logger.color.green)
      
    const history = JSON.parse(readFileSync('./history.json'))

    while (true) {
      logger.info(`Fetching rss`)
      const res = await fetch(url)
      const body = await res.text()
      const jsonObj = parser.parse(body)
      const items = jsonObj.rss?.channel?.item
  
      for (const item of items) {
        if (item.title.match(/\[Batch\]/)) {
          logger.debug(`Skipping batch: ${item.title}`)
          continue
        }
  
        if (history.includes(item.guid)) {
          logger.debug(`Skipping already processed: ${item.title}`)
          continue
        }
    
        logger.info(`Publishing ${item.title}`)
        const data = {
          title: item.title,
          link: item.link,
          show: item.category
        }
    
        await channel.publish(
          outbound.exchange,
          outbound.routingKey,
          Buffer.from(JSON.stringify(data)),
          { persistent: true }
        )
  
        history.push(item.guid)
        writeFileSync('./history.json', JSON.stringify(history))
      }

      await sleep(300000) // 5 minutes
    }
  }
  catch (e) {
    logger.error(e)
  }
})()