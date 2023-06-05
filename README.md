# Rabbit-Wrapper

# TODO:
- Change the existing logging functions with new communicationLog unction
  * logMqMessageReceived will be replaced by it
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


# V2:
- Create a config (based eg. on environmental variables) that would:
   * allow user to anonimize logs' contents
   * allow message wise and global wise anonymization
   * option to enable / disable requestId in logs

- Multiple Replies:
1. [v2] Make the response spread if only content is specified
2. [v2] Allow from user a whitelist of possible servers also instead of waitedReplies



# RequestTracerSolution:

  Get from the client set and get request Id functions then use them in Rpc calls

  const {client, server} = r4bbitSetup({
    logger: falseLog,
    requestTracer: {
      setReqId: setReqId,
      getReqId: getReqId,
    }
  })

  client.sendRpc


  clientRpcRequest

    if getReqId
        X-Request-Id: getReqId()
    else
        X-Request-Id: cuid()


    [X-Request-Id]: getReqId() ?? await getReqId() : cuid();


  serverRpcRequest

    if X-Request-Id
        setReqId(X-Request-Id)
    else
        setReqId(cuid())




