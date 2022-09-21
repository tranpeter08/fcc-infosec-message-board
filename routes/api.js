'use strict';
const e = require('express');
const multer = require('multer');
const {
  createThread,
  getThreads,
  createReply,
  getReplies,
  deleteThread,
  deleteReply,
  reportReply,
  reportThread,
} = require('../database/messageBoardService');
const { validateReqBodyFields } = require('../utils/validators');

const upload = multer();

/**
 *
 * @param {e.Application} app
 */
module.exports = function (app) {
  app
    .route('/api/threads/:board')
    .get(async (req, res, next) => {
      const { board } = req.params;
      try {
        const data = await getThreads(board);

        res.json(data);
      } catch (error) {
        next(error);
      }
    })
    .post(upload.none(), async (req, res, next) => {
      try {
        // form data with text and delete_password
        const { text, delete_password } = req.body;
        const { board } = req.params;

        // store in db
        const result = await createThread(board, text, delete_password);

        res.status(201).json(result);
      } catch (error) {
        next(error);
      }
    })
    .delete(
      upload.none(),
      validateReqBodyFields(['thread_id', 'delete_password']),
      async (req, res, next) => {
        try {
          const { board } = req.params;
          const { thread_id, delete_password } = req.body;
          const data = await deleteThread(thread_id, board, delete_password);
          res.send(data);
        } catch (error) {
          next(error);
        }
      }
    )
    .put(
      upload.none(),
      validateReqBodyFields(['report_id']),
      async (req, res, next) => {
        try {
          const { board } = req.params;
          const { report_id } = req.body;
          const data = await reportThread(report_id, board);
          res.send(data);
        } catch (error) {
          next(error);
        }
      }
    );

  app
    .route('/api/replies/:board')
    .post(upload.none(),
      validateReqBodyFields(['text', 'delete_password', 'thread_id']), 
      async (req, res, next) => {
      try {
        const { board } = req.params;
        const { text, delete_password, thread_id } = req.body;
        const data = await createReply(thread_id, text, delete_password, board);

        res.send(data);
      } catch (error) {
        next(error);
      }
    })
    .get(async (req, res, next) => {
      try {
        const { board } = req.params;
        const { thread_id } = req.query;

        if (!thread_id) throw 'missing thread_id';

        const data = await getReplies(thread_id, board);

        res.json(data);
      } catch (error) {
        next(error);
      }
    })
    .delete(
      upload.none(),
      validateReqBodyFields(['thread_id', 'reply_id', 'delete_password']),
      async (req, res, next) => {
        try {
          const { board } = req.params;
          const { thread_id, reply_id, delete_password } = req.body;
          
          const data = await deleteReply(
            thread_id,
            reply_id,
            delete_password,
            board
          );

          res.send(data);
        } catch (error) {
          next(error);
        }
      }
    )
    .put(
      upload.none(),
      // validateReqBodyFields(['thread_id', 'reply_id']),
      async (req, res, next) => {
        try {
          const { board } = req.params;
          const { thread_id, reply_id } = req.body;
          const data = await reportReply(thread_id, reply_id, board);
          res.send(data);
        } catch (error) {
          next(error);
        }
      }
    );
};
