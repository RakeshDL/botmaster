import test from 'ava';
import request from 'request-promise';
import { outgoingMessageFixtures,
         incomingUpdateFixtures,
         attachmentFixtures } from 'botmaster-test-fixtures';

import Botmaster from '../../lib';
import MockBot from '../_mock_bot';

test('throws an error if key is not incoming or outgoing', (t) => {
  t.plan(1);

  const bot = new MockBot();
  try {
    bot.use({
      something: 'something',
    });
  } catch (err) {
    t.is(err.message,
      'invalid middleware type. Type should be either \'incoming\' or \'outgoing\'',
      'Error message is not the same as expected');
  }
});

test('throws an error if middlewareCallback is not defined', (t) => {
  t.plan(1);

  const bot = new MockBot();
  try {
    bot.use({
      incoming: 'something',
    });
  } catch (err) {
    t.is(err.message,
      'middlewareCallback can\'t be of type undefined. It needs to be a function',
      'Error message is not the same as expected');
  }
});

test('throws an error if middlewareCallback is not a function', (t) => {
  t.plan(1);

  const bot = new MockBot();
  try {
    bot.use({
      incoming: {
        cb: 'not a function',
      },
    });
  } catch (err) {
    t.is(err.message,
      'middlewareCallback can\'t be of type string. It needs to be a function',
      'Error message is not the same as expected');
  }
});

test('throws an error if options is not an object', (t) => {
  t.plan(1);

  const bot = new MockBot();
  try {
    bot.use({
      incoming: {
        cb: __ => __, // this is just a function returning it's passed value
        options: 'something',
      },
    });
  } catch (err) {
    t.is(err.message,
      'options can\'t be of type string. It needs to be an object',
      'Error message is not the same as expected');
  }
});

test('throws an error if options is not an object', (t) => {
  t.plan(1);

  const bot = new MockBot();
  try {
    bot.use({
      incoming: {
        cb: __ => __, // this is just a function returning it's passed value
      },
      outgoing: {
        cb: __ => __,
      },
    });
  } catch (err) {
    t.is(err.message,
      '"use" should be called with only one of incoming or outgoing. Use useWrapped instead',
      'Error message is not the same as expected');
  }
});

test('throws an error if options contains both botTypesToInclude and botTypesToExclude', (t) => {
  t.plan(1);

  const bot = new MockBot();
  try {
    bot.use({
      incoming: {
        cb: __ => __, // this is just a function returning it's passed value
        options: {
          botTypesToExclude: 'a',
          botTypesToInclude: 'b',
        },
      },
    });
  } catch (err) {
    t.is(err.message,
      'Please use only one of botTypesToInclude and botTypesToExclude');
  }
});

test('Errors in incoming middleware are emitted correctly', (t) => {
  t.plan(1);

  return new Promise((resolve) => {
    const botmaster = new Botmaster();
    botmaster.addBot(new MockBot({
      requiresWebhook: true,
      webhookEndpoint: 'webhook',
      type: 'express',
    }));

    botmaster.use({
      incoming: {
        cb: (bot, update, next) => {
          update.blop();
          next();
        },
      },
    });

    botmaster.on('error', (bot, err) => {
      t.is(err.message,
           '"update.blop is not a function". In incoming middleware',
           'Error message did not match');
      botmaster.server.close(resolve);
    });

    botmaster.on('listening', () => {
      const updateToSend = { text: 'Change this' };
      const requestOptions = {
        method: 'POST',
        uri: 'http://localhost:3000/express/webhook',
        json: updateToSend,
      };

      request(requestOptions);
    });
  });
});

test('calls the incoming middleware function specified if all is setup correctly without calling any outgoing middleware', (t) => {
  t.plan(1);

  return new Promise((resolve) => {
    const botmaster = new Botmaster();
    botmaster.addBot(new MockBot({
      requiresWebhook: true,
      webhookEndpoint: 'webhook',
      type: 'express',
    }));

    botmaster.use({
      incoming: {
        cb: (bot, update, next) => {
          update.message.text = 'Hello World!';
          next();
        },
      },
    });

    botmaster.use({
      outgoing: {
        cb: (bot, update, next) => {
          t.fail('outgoing middleware should not be called');
          next();
        },
      },
    });

    botmaster.on('update', (bot, update) => {
      t.is(update.message.text, 'Hello World!', 'update object did not match');
      botmaster.server.close(resolve);
    });

    botmaster.on('listening', () => {
      const updateToSend = { text: 'Change this' };
      const requestOptions = {
        method: 'POST',
        uri: 'http://localhost:3000/express/webhook',
        json: updateToSend,
      };

      request(requestOptions);
    });
  });
});

test('calls the incoming middleware function specified if all is setup correctly and use is specified before addBot', (t) => {
  t.plan(1);

  return new Promise((resolve) => {
    const botmaster = new Botmaster();

    botmaster.use({
      incoming: {
        cb: (bot, update, next) => {
          update.message.text = 'Hello World!';
          next();
        },
      },
    });

    botmaster.addBot(new MockBot({
      requiresWebhook: true,
      webhookEndpoint: 'webhook',
      type: 'express',
    }));

    botmaster.on('update', (bot, update) => {
      t.is(update.message.text, 'Hello World!', 'update object did not match');
      botmaster.server.close(resolve);
    });

    botmaster.on('listening', () => {
      const updateToSend = { text: 'Change this' };
      const requestOptions = {
        method: 'POST',
        uri: 'http://localhost:3000/express/webhook',
        json: updateToSend,
      };

      request(requestOptions);
    });
  });
});

test('calls the incoming middleware should work in standalone using __emitUpdate', (t) => {
  t.plan(1);

  return new Promise((resolve) => {
    const bot = new MockBot({
      requiresWebhook: true,
      webhookEndpoint: 'webhook',
      type: 'express',
    });

    bot.use({
      incoming: {
        cb: (bot, update, next) => {
          update.text = 'Hello World!';
          next();
        },
      },
    });

    bot.on('update', (update) => {
      t.is(update.text, 'Hello World!', 'update object did not match');
      resolve();
    });

    bot.__emitUpdate({ text: 'Change this' });
  });
});


test('calls the incoming middleware should occur in order of declaration', (t) => {
  t.plan(1);

  return new Promise((resolve) => {
    const bot = new MockBot({
      requiresWebhook: true,
      webhookEndpoint: 'webhook',
      type: 'express',
    });

    bot.use({
      incoming: {
        cb: (bot, update, next) => {
          update.text = 'Hello World!';
          next();
        },
      },
    });

    bot.use({
      incoming: {
        cb: (bot, update, next) => {
          update.text += ' And others';
          next();
        },
      },
    });

    bot.on('update', (update) => {
      t.is(update.text, 'Hello World! And others', 'update object did not match');
      resolve();
    });

    bot.__emitUpdate({ text: 'Change this' });
  });
});

test('Making extensive use of options works', (t) => {
  t.plan(3);

  return new Promise((resolve) => {
    const botmaster = new Botmaster();
    botmaster.addBot(new MockBot({
      type: 'dontIncludeMe',
      receives: {
        text: true,
        echo: true,
      },
      sends: {
        text: true,
        quickReply: true,
      },
    }));
    botmaster.addBot(new MockBot({
      type: 'includeMe',
      receives: {
        echo: true,
      },
      sends: {
        text: true,
        quickReply: true,
      },
    }));
    botmaster.addBot(new MockBot({
      type: 'excludeMe',
      receives: {
        text: true,
        echo: true,
      },
      sends: {
        text: true,
      },
    }));

    botmaster.use({
      incoming: {
        cb: (bot, update, next) => {
          update.number += 1;
          next();
        },
        options: {
          botTypesToInclude: 'includeMe',
        },
      },
    });

    botmaster.use({
      incoming: {
        cb: (bot, update, next) => {
          update.number += 10;
          next();
        },
        options: {
          botTypesToExclude: 'excludeMe',
        },
      },
    });

    botmaster.use({
      incoming: {
        cb: (bot, update, next) => {
          update.number += 100;
          next();
        },
        options: {
          botReceives: 'text',
        },
      },
    });

    botmaster.use({
      incoming: {
        cb: (bot, update, next) => {
          update.number += 1000;
          next();
        },
        options: {
          botSends: 'quickReply',
        },
      },
    });

    let passes = 0;
    botmaster.on('update', (bot, update) => {
      passes += 1;
      if (bot.type === 'includeMe') {
        t.is(update.number, 1011, 'update object did not match for includeMe');
      } else if (bot.type === 'excludeMe') {
        t.is(update.number, 100, 'update object did not match for excludeMe');
      } else if (bot.type === 'dontIncludeMe') {
        t.is(update.number, 1110, 'update object did not match for dontIncludeMe')
      }

      if (passes === 3) {
        botmaster.server.close(resolve);
      }
    });

    botmaster.on('listening', () => {
      // inside of here just to make sure I don't close a server
      // that is not listening yet
      for (const bot of botmaster.bots) {
        bot.__emitUpdate({ number: 0 });
      }
    });
  });
});

//   describe('Outgoing Middleware', function() {
//     this.retries(4);

//     specify('Botmaster should call a middleware function that was setup', function(done) {
//       // outgoing middleware
//       botmaster.use('outgoing', function(bot, message, next) {
//         message.recipient.id = config.messengerUserId;
//         return next();
//       });

//       const bot = botmaster.getBots('messenger')[0];

//       const outgoingMessageCopy = _.cloneDeep(outgoingMessage);
//       bot.sendMessage(outgoingMessageCopy)

//       .then(function(body) {
//         expect(body.sent_message).to.not.equal(undefined);
//         done();
//       });
//     });

//     specify('Error in outgoing middleware is thrown on sendMessage', function(done) {
//       // outgoing middleware
//       botmaster.use('outgoing', function(bot, message, next) {
//         message.blob(); // doesn't exist, should throw
//         return next();
//       });

//       const bot = botmaster.getBots('messenger')[0];

//       const outgoingMessageCopy = _.cloneDeep(outgoingMessage);
//       bot.sendMessage(outgoingMessageCopy)

//       // catch error with promise
//       .catch(function(err) {
//         expect(err.message).to.equal('"message.blob is not a function". In outgoing middleware');
//         // get error in callback
//         bot.sendMessage(outgoingMessage, function(err) {
//           expect(err.message).to.equal('"message.blob is not a function". In outgoing middleware');
//           done();
//         });
//       });
//     });

//     specify('Outgoing middleware should be ignored if configured so using reply', function(done) {
//       // outgoing middleware should never be hit
//       botmaster.use('outgoing', function(bot, message, next) {
//         expect(1).to.equal(2);
//         return next();
//       });

//       const bot = botmaster.getBots('messenger')[0];

//       // using reply
//       const incomingUpdateCopy = _.cloneDeep(incomingUpdate);
//       incomingUpdateCopy.sender.id = config.messengerUserId;

//       bot.reply(incomingUpdateCopy, 'Party & Bullshit',
//                 { ignoreMiddleware: true })

//       .then(function() {
//         return bot.reply(incomingUpdateCopy, 'Party & Bullshit',
//                          { ignoreMiddleware: true }, function() {
//           done();
//         });
//       });
//     });

//     specify('Outgoing middleware should be ignored if configured so using sendAttachmentFromURLTo', function(done) {
//       // outgoing middleware should never be hit
//       botmaster.use('outgoing', function(bot, message, next) {
//         expect(1).to.equal(2);
//         return next();
//       });

//       const bot = botmaster.getBots('messenger')[0];

//       const url = 'https://raw.githubusercontent.com/ttezel/twit/master/tests/img/bigbird.jpg';
//       bot.sendAttachmentFromURLTo(
//         'image', url, config.messengerUserId, { ignoreMiddleware: true })

//       .then(function() {
//         done();
//       });
//     });

//     specify('Outgoing middleware should be ignored if configured so using sendDefaultButtonMessageTo', function(done) {
//       // outgoing middleware should never be hit
//       botmaster.use('outgoing', function(bot, message, next) {
//         expect(1).to.equal(2);
//         return next();
//       });

//       const bot = botmaster.getBots('messenger')[0];

//       bot.sendDefaultButtonMessageTo(
//         ['button1', 'button2'], config.messengerUserId, 'select something',
//         { ignoreMiddleware: true })

//       .then(function() {
//         // using sendDefaultButtonMessageTo with callback
//         bot.sendDefaultButtonMessageTo(
//           ['button1', 'button2'], config.messengerUserId, 'select something',
//           { ignoreMiddleware: true }, function() {

//           done();
//         });
//       });
//     });

//     specify('Outgoing middleware should be ignored if configured so using sendIsTypingMessageTo', function(done) {
//       // outgoing middleware should never be hit
//       botmaster.use('outgoing', function(bot, message, next) {
//         expect(1).to.equal(2);
//         return next();
//       });

//       const bot = botmaster.getBots('messenger')[0];

//       const outgoingMessageCopy = _.cloneDeep(outgoingMessage);
//       outgoingMessageCopy.recipient.id = config.messengerUserId;

//       bot.sendIsTypingMessageTo(config.messengerUserId,
//           { ignoreMiddleware: true })

//       .then(function() {
//         done();
//       });
//     });

//     specify('Outgoing middleware should be ignored if configured so using sendTextCascadeTo', function(done) {
//       this.timeout(8000);
//       // outgoing middleware should never be hit
//       botmaster.use('outgoing', function(bot, message, next) {
//         expect(1).to.equal(2);
//         return next();
//       });

//       const bot = botmaster.getBots('messenger')[0];

//       bot.sendTextCascadeTo(
//         ['message1', 'message2'], config.messengerUserId,
//         { ignoreMiddleware: true })

//       .then(function() {
//         // using sednCascade without callback
//         return bot.sendTextCascadeTo(
//           ['message1', 'message2'], config.messengerUserId,
//           { ignoreMiddleware: true }, function() {

//           done();
//         });
//       });
//     });

//     specify('Botmaster should not call incoming middleware', function(done) {
//       botmaster.use('incoming', function(bot, update, next) {
//         // something wrong as this should not happen
//         update.recipient.id = config.messengerUserId;
//         next();
//       });

//       const bot = botmaster.getBots('messenger')[0];

//       const outgoingMessageCopy = _.cloneDeep(outgoingMessage);
//       bot.sendMessage(outgoingMessageCopy)

//       .catch(function(err) {
//         expect(err).to.not.equal(undefined);
//         done();
//       });
//     });

//   });

//   describe('new syntax (bot, update, message, next) in outgoing', function () {
//     specify('manually setting __update in sendOptions should pass it through to outgoing adopting the new syntax', function (done) {
//       const mockUpdate = { id: 1 };
//       const messageToSend = { id: 2 };
//       botmaster.use('outgoing', function (bot, update, message, next) {
//         assert(message === messageToSend);
//         assert(update === mockUpdate);
//         done();
//       });
//       const bot = botmaster.getBots('messenger')[0];
//       bot.sendMessage(messageToSend, { __update: mockUpdate });
//     });

//     specify('using __createBotPatchedWithUpdate should pass update with sendMessage through to outgoing adopting the new syntax', function (done) {
//       const mockUpdate = { id: 2 };
//       const messageToSend = { id: 3 };
//       botmaster.use('outgoing', function (bot, update, message, next) {
//         assert(message === messageToSend);
//         assert(update === mockUpdate);
//         done();
//       });
//       const bot = botmaster.getBots('messenger')[0].__createBotPatchedWithUpdate(mockUpdate);
//       bot.sendMessage(messageToSend);
//     });

//     specify('using __createBotPatchedWithUpdate with no options and a callback should pass update with sendMessage through to outgoing adopting the new syntax', function (done) {
//       const mockUpdate = { id: 2 };
//       const messageToSend = { id: 3 };
//       botmaster.use('outgoing', function (bot, update, message, next) {
//         console.log(message);
//         console.log(update);
//         expect(message).to.equal(messageToSend);
//         expect(update).to.equal(mockUpdate);
//       });
//       const bot = botmaster.getBots('messenger')[0].__createBotPatchedWithUpdate(mockUpdate);
//       bot.sendMessage(messageToSend, (err, body) => {
//         done();
//       });
//     });

//     specify('from a reply in incoming middleware the update should be sent through to outgoing adopting the new syntax', function (done) {
//       botmaster.use('incoming', function (bot, update, next) {
//         update.newProp = 1;
//         bot.reply(update, 'right back at you!', function(err, body) {
//           done();
//         });
//       });
//       botmaster.use('outgoing', function (bot, update, message, next) {
//         assert(message.message.text === 'right back at you!', 'the message should be correct');
//         assert(update.newProp === 1, 'new prop should exist in update');
//         assert(update === incomingUpdateCopy, 'should still have the same reference to the update');
//         next();
//       });
//       const bot = botmaster.getBots('telegram')[0];
//       const incomingUpdateCopy = _.cloneDeep(incomingUpdate);
//       bot.__emitUpdate(incomingUpdateCopy);
//     });

//     specify('from a reply in an on update handler for botmaster the update should be sent through to outgoing adopting the new syntax', function (done) {
//       botmaster.once('update', function (bot, update, next) {
//         update.newProp = 1;
//         bot.reply(update, 'right back at you!');
//       });
//       botmaster.use('outgoing', function (bot, update, message, next) {
//         assert(message.message.text === 'right back at you!', 'the message should be correct');
//         assert(update.newProp === 1, 'new prop should exist in update');
//         assert(update === incomingUpdateCopy, 'should still have the same reference to the update');
//         done();
//       });
//       const bot = botmaster.getBots('messenger')[0];
//       const incomingUpdateCopy = _.cloneDeep(incomingUpdate);
//       bot.__emitUpdate(incomingUpdateCopy);
//     });
//   });

//   afterEach(function (done) {
//     this.retries(4);
//     process.nextTick(function () {
//       botmaster.server.close(function () { done(); });
//     });
//   });

// });
