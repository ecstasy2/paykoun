@e2e
Feature: Initialization of a context
  We should be able to connect to the undelying message queue and handle error
  correctly

Scenario: Connect to rabbitmq server

  Given a file named "paykoun-init.js" with content:
    """
    hello world
    """
