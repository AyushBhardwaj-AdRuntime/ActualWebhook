# First GitHub Webhook Experiment

## Objective

Receive actual GitHub webhook events in a local
Node.js application using ngrok.

## Architecture

GitHub
  -> ngrok public URL
  -> localhost
  -> Express webhook endpoint

## Events Tested

- ping
- push

## Observations

1. GitHub sends an HTTP POST request.
2. The request contains event metadata in headers.
3. The push event contains repository and commit information.
4. The Express endpoint returns HTTP 200.
5. ngrok allows GitHub to reach the local server.

## Current Limitations

- No signature verification yet.
- No durable event storage.
- No duplicate-event protection.
- No asynchronous processing.
- No recovery mechanism for lost events.

## Next Step

Implement webhook signature verification and test
the receiver against forged requests.