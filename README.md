# Rabbit-Wrapper

# TODO:


- Add a global set up when starting the application that reveals request ids etc.
- Add to the logs the topic exchange name.topic (log.child)
- Add global config (support for env vars and silent mode)
- Add possibility to client and server functions tto cencor data
- Add a connection close function so that users can actually close the connection
- Add loger in order to warn onClose and retry connection after some interval
- When rabbitmq does not exist warn the client
- Gracefully close the connection
- sonar-cloud
- GitHub packages for versioning 
    -- automatic semantic versioning
- Documentation
    - example
- GitHub Pages
- Add timeout on establishing connection with rabbit 
    (eg. should throw an arror when there is no active RabbitMQ service)
- Create a workflow that installs rabbitmq and write e2e tests that actually test the behaviour


# Multiple Replies:
1. [v2] Make the response spread if only content is specified
2. [v2] Allow from user a whitelist of possible servers also instead of waitedReplies



