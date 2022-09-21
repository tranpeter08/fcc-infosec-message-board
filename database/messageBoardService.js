const supabase = require('./index');
const { faker } = require('@faker-js/faker');

const devTables = {
  threads: 'threads',
  replies: 'replies',
};

const testTables = {
  threads: 'threads_test',
  replies: 'replies_test',
};

const tables = process.env.NODE_ENV === 'test' ? testTables : devTables;

function messageBoardService(tables = devTables) {
  return {
    async createThread(board, text, delete_password) {
      const { data, error } = await supabase
        .from(tables.threads)
        .insert([{ board, text, delete_password }]);

      if (error) return 'Error creating thread';

      const result = data[0];
      result.replies = [];

      return result;
    },

    async getThreads(board) {
      const { data, error } = await supabase
        .from(tables.threads)
        .select(
          `
          _id,
          bumped_on,
          created_on,
          text,
          board,
          replies:${tables.replies} (
            _id,
            created_on,
            text
            )
        `
        )
        .order('bumped_on', { ascending: false })
        .eq('board', board)
        .limit(10)
        .order('created_on', { foreignTable: 'replies', ascending: false })
        .limit(3, { foreignTable: 'replies' });

      if (data === null) throw 'Error getting threads';

      return data;
    },

    async reportThread(thread_id, board) {
      const { count, error } = await supabase
        .from(tables.threads)
        .update({ reported: true }, { count: 'exact' })
        .match({ _id: thread_id, board });

      if (error | !count) return 'Error reporting thread';

      return 'reported';
    },

    async deleteThread(thread_id, board, delete_password) {
      const success = 'success';
      const fail = 'incorrect password';

      const { error, count } = await supabase
        .from(tables.threads)
        .select('_id', { count: 'exact', head: true })
        .match({
          _id: thread_id,
          board,
          delete_password,
        });

      if (error) throw error;
      if (!count) return fail;

      const { error: replyError } = await supabase
        .from(tables.replies)
        .delete()
        .match({ thread_id });

      if (replyError) throw replyError;

      const { error: threadError, count: deleteCount } = await supabase
        .from(tables.threads)
        .delete({ count: 'exact' })
        .match({ _id: thread_id, board, delete_password });

      if (threadError) throw threadError;
      if (!deleteCount) return fail;

      return success;
    },

    async createReply(thread_id, text, delete_password, board) {
      const date = new Date().toUTCString();

      const { count } = await supabase
        .from(tables.threads)
        .select('*', { count: 'exact', head: true })
        .match({ _id: thread_id, board });

      if (!count) return 'thread not found';

      const threadReq = supabase
        .from(tables.threads)
        .update({
          bumped_on: date,
        })
        .match({ _id: thread_id, board });

      const replyReq = supabase.from(tables.replies).insert([
        {
          thread_id,
          text,
          delete_password,
          created_on: date,
        },
      ]);

      const [threadResp, replyResp] = await Promise.all([threadReq, replyReq]);

      if (threadResp.error || replyResp.error) return 'Error creating reply';

      return replyResp.data[0];
    },

    async getReplies(thread_id, board) {
      const { data, error } = await supabase
        .from(tables.threads)
        .select(
          `
            _id,
            bumped_on,
            created_on,
            text,
            board,
            replies:replies (
              _id,
              created_on,
              text)
          `
        )
        .match({ _id: thread_id, board });

      if (error) throw error;

      const notFound =
        data === null || (Array.isArray(data) && data.length === 0);

      if (notFound) {
        return {};
      }

      return data[0];
    },

    async reportReply(thread_id, reply_id, board) {
      const threadReq = supabase
        .from(tables.threads)
        .select('*', { count: 'exact', head: true })
        .match({ _id: thread_id, board });

      const replyReq = supabase
        .from(tables.replies)
        .update({ reported: true }, { count: 'exact' })
        .match({ _id: reply_id, thread_id });

      const responses = await Promise.all([threadReq, replyReq]);
      console.log(responses);

      for (const resp of responses) {
        const { count, error, statusText } = resp;

        if (!count || error) return 'reply not found';
      }

      return 'reported';
    },

    async deleteReply(thread_id, reply_id, delete_password, board) {
      const success = 'success';
      const fail = 'incorrect password';
      const queryParams = { thread_id, _id: reply_id, delete_password };

      const threadReq = supabase
        .from(tables.threads)
        .select('board', { count: 'exact', head: true })
        .match({ _id: thread_id, board });

      const replyReq = supabase
        .from(tables.replies)
        .select('_id', { count: 'exact', head: true })
        .match(queryParams);

      const responses = await Promise.all([threadReq, replyReq]);

      for (const resp of responses) {
        const { count, error } = resp;
        if (!count || error) return fail;
      }

      const { count: updatedCount, error: updatedError } = await supabase
        .from(tables.replies)
        .update({ text: '[deleted]' }, { count: 'exact' })
        .match(queryParams);

      if (updatedError) throw updatedError;
      if (!updatedCount) return fail;

      return success;
    },

    async createRandomThreads() {
      console.log('create random threads');
      const threads = [];
      const replies = [];
      const board = 'test_board';
      const daysInMillisecs = 24 * 60 * 60 * 1000;

      for (let i = 0; i < 10; i++) {
        const threadData = {
          board,
          text: faker.lorem.text(),
          delete_password: faker.lorem.word(8),
          // recent dates extended 90 days starting from 30 days ago
          bumped_on: faker.date.recent(90, Date.now() - 30 * daysInMillisecs),
          // recent dates extended 90 days starting from 40 days ago
          created_on: faker.date.recent(90, Date.now() - 40 * daysInMillisecs),
        };

        threads.push(threadData);
      }

      const { data, error } = await supabase
        .from(tables.threads)
        .insert(threads);

      if (error) throw error;

      for (const thread of data) {
        for (let i = 0; i < 5; i++) {
          replies.push({
            thread_id: thread._id,
            text: faker.lorem.text(),
            delete_password: faker.lorem.word(8),
            // created within the recent 29 days
            created_on: faker.date.recent(29),
          });
        }
      }

      const { data: replyData, error: replyError } = await supabase
        .from(tables.replies)
        .insert(replies);

      if (replyError) throw error;

      return data;
    },

    async truncateTables() {
      console.log('truncate tables');
      const repliesDelete = await supabase
        .from(tables.replies)
        .delete()
        .neq('_id', 0);

      const threadsDelete = await supabase
        .from(tables.threads)
        .delete()
        .neq('_id', 0);
    },
  };
}

module.exports = messageBoardService(tables);
