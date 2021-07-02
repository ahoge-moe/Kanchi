const amqp = require('amqplib')
const logger = require('logger')
const { readFileSync } = require('fs')
const { rabbitmq: { outbound } } = require('@iarna/toml').parse(readFileSync('config/config.toml'))

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

    const { magnet_links } = require('@iarna/toml').parse(readFileSync('config/manual.toml'))
      
    for (const link of magnet_links) {  
      logger.info(`Publishing`)
  
      await channel.publish(
        outbound.exchange,
        outbound.routingKey,
        Buffer.from(link),
        { persistent: true }
      )
    }

    logger.info(`Closing channel and connection`)
    await channel.close()
    await connection.close()
    logger.success(`Channel and connection closed`)
  }
  catch (e) {
    logger.error(e)
  }
})()