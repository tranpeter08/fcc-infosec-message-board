const chaiHttp = require('chai-http');
const chai = require('chai');
const assert = chai.assert;
const server = require('../server');
const {
  createRandomThreads,
  truncateTables,
} = require('../database/messageBoardService');
const { faker } = require('@faker-js/faker');

chai.use(chaiHttp);

function randomIndex() {
  return faker.datatype.number({ min: 0, max: 9 });
}

suite('Functional Tests', function () {
  const threadFields = [
    '_id',
    'created_on',
    'bumped_on',
    'text',
    'delete_password',
    'reported',
    'board',
    'replies',
  ];

  const threadFieldsPublic = [
    '_id',
    'created_on',
    'bumped_on',
    'text',
    'board',
    'replies',
  ];

  const replyFields = [
    '_id',
    'created_on',
    'text',
    'delete_password',
    'reported',
  ];

  const replyFieldsPublic = ['_id', 'created_on', 'text'];

  let board = 'test_board';
  const threadEndpoint = '/api/threads/';
  const replyEndpoint = '/api/replies/';
  let savedThreadForDelete = null;
  let savedThreads = null;
  let savedReply = null;

  test('Creating a new thread: POST request to /api/threads/{board}', (done) => {
    const text = 'test test';
    const delete_password = '123abc';

    chai
      .request(server)
      .post(threadEndpoint + board)
      .type('form')
      .send({ text, delete_password })
      .end((err, res) => {
        for (const field of threadFields) {
          assert.property(res.body, field);
        }

        const thread = res.body;

        assert.equal(thread.text, text);
        assert.equal(thread.board, board);
        assert.equal(thread.reported, false);
        assert.equal(thread.delete_password, delete_password);
        assert.isArray(thread.replies);
        assert.equal(thread.replies.length, 0);

        savedThreadForDelete = thread;

        done();
      });
  });


  test('Deleting a thread with the incorrect password: DELETE request to /api/threads/{board} with an invalid delete_password', (done) => {
    const wrongPassword = 'wrongpassword';

    chai
      .request(server)
      .delete(threadEndpoint + board)
      .type('form')
      .send({
        thread_id: savedThreadForDelete._id,
        delete_password: wrongPassword,
      })
      .end((err, res) => {
        assert.typeOf(res.text, 'string');
        assert.equal(res.text, 'incorrect password');
        done();
      });
  });

  test('Deleting a thread with the correct password: DELETE request to /api/threads/{board} with a valid delete_password', (done) => {
    const { delete_password, _id } = savedThreadForDelete;

    chai
      .request(server)
      .delete(threadEndpoint + board)
      .type('form')
      .send({ thread_id: _id, delete_password })
      .end((err, res) => {
        assert.typeOf(res.text, 'string');
        assert.equal(res.text, 'success');
        done();
      });
  });

  test('Viewing the 10 most recent threads with 3 replies each: GET request to /api/threads/{board}', (done) => {
    function getBumpedOnMilliSecs(thread) {
      return new Date(thread.bumped_on).getTime();
    }

    createRandomThreads()
      .then(() => {
        return chai.request(server).get(threadEndpoint + board);
      })
      .then((res) => {
        assert.isArray(res.body);
        const threads = res.body;
        assert.lengthOf(threads, 10);

        for (let i = 1; i < 10; i++) {
          const prevThread = threads[i - 1];
          const thread = threads[i];
          const previousDate = getBumpedOnMilliSecs(prevThread);
          const currentDate = getBumpedOnMilliSecs(thread);

          //  Check if threads are sorted by date in descending order
          assert.isAtLeast(previousDate, currentDate);

          // Checks that replies are limitd to 3
          assert.isAtMost(thread.replies.length, 3);
        }

        savedThreads = threads;

        done();
      })
      .catch((e) => {
        throw e;
      });
  });

  test('Reporting a thread: PUT request to /api/threads/{board}', (done) => {
    const index = randomIndex();

    const thread = savedThreads[index];
    const { _id } = thread;

    // console.log('saved thread:', thread);

    const success = 'reported';

    chai
      .request(server)
      .put(threadEndpoint + board)
      .type('form')
      .send({ report_id: _id })
      .end((err, res) => {
        const message = res.text;
        assert.typeOf(message, 'string');
        assert.equal(message, success);
        done();
      });
  });

  test('Creating a new reply: POST request to /api/replies/{board}', (done) => {
    const index = randomIndex();
    const { _id: thread_id } = savedThreads[index];
    const text = 'reply text';
    const delete_password = '123abc';

    chai
      .request(server)
      .post(replyEndpoint + board)
      .type('form')
      .send({ thread_id, text, delete_password })
      .end((err, res) => {
        const reply = res.body;
        assert.exists(reply);

        for (const field of replyFields) {
          assert.property(reply, field);
        }

        savedReply = reply;
        done();
      });
  });

  test('Viewing a single thread with all replies: GET request to /api/replies/{board}', (done) => {
    const { thread_id, _id } = savedReply;

    chai
      .request(server)
      .get(replyEndpoint + board)
      .query({ thread_id })
      .end((err, res) => {
        const thread = res.body;
        assert.exists(thread);

        for (const field of threadFieldsPublic) {
          assert.property(thread, field);
        }

        const results = thread.replies.find((reply) => {
          return reply._id === _id;
        });

        assert.exists(results);

        done();
      });
  });

  test('Deleting a reply with the incorrect password: DELETE request to /api/replies/{board} with an invalid delete_password', (done) => {
    const { _id, thread_id } = savedReply;
    const wrongPassword = 'wrongpassword';
    const fail = 'incorrect password';

    chai
      .request(server)
      .delete(replyEndpoint + board)
      .type('form')
      .send({ reply_id: _id, thread_id, delete_password: wrongPassword })
      .end((err, res) => {
        const message = res.text;
        assert.typeOf(message, 'string');
        assert.equal(message, fail);

        done();
      });
  });

  test('Reporting a reply: PUT request to /api/replies/{board}', (done) => {
    const { _id, thread_id } = savedReply;
    const success = 'reported';

    chai
      .request(server)
      .put(replyEndpoint + board)
      .type('form')
      .send({ reply_id: _id, thread_id })
      .end((err, res) => {
        const message = res.text;
        assert.typeOf(message, 'string');
        assert.equal(message, success);
        done();
      });
  });

  test('Deleting a reply with the correct password: DELETE request to /api/replies/{board} with a valid delete_password', (done) => {
    const { _id, thread_id, delete_password } = savedReply;
    const success = 'success';

    chai
      .request(server)
      .delete(replyEndpoint + board)
      .type('form')
      .send({ reply_id: _id, thread_id, delete_password })
      .end((err, res) => {
        const message = res.text;
        assert.typeOf(message, 'string');
        assert.equal(message, success);

        done();
      });
  });

  test('Truncate tables', (done) => {
    truncateTables()
      .then(() => {
        assert.equal(1, 1);
        done();
      })
      .catch((e) => {
        console.log(e);

        throw e;
      });
  });
});
