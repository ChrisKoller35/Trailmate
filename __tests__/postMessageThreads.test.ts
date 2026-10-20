import { groupPostMessages, selectPostThread, replyRecipient } from '../lib/postMessageThreads';
import type { PostMessage } from '../types';

const OWNER = 'owner';
let n = 0;
function msg(from: string, to: string, minute: number, isRead = false, postId = 'p1'): PostMessage {
  n++;
  return {
    id: `m${n}`,
    post_id: postId,
    sender_id: from,
    receiver_id: to,
    content: `text ${n}`,
    is_read: isRead,
    created_at: new Date(2026, 9, 19, 10, minute).toISOString(),
  };
}

describe('groupPostMessages', () => {
  it('builds one conversation per sender of the same post', () => {
    const groups = groupPostMessages(
      [msg('anna', OWNER, 1), msg('ben', OWNER, 2), msg(OWNER, 'anna', 3, true)],
      OWNER,
    );
    expect(groups.map((g) => g.otherUserId)).toEqual(['anna', 'ben']);
    expect(groups[0].messages).toHaveLength(2);
    expect(groups[1].messages).toHaveLength(1);
  });

  it('sorts messages oldest first and conversations newest first', () => {
    const groups = groupPostMessages(
      [msg('anna', OWNER, 5), msg('anna', OWNER, 1), msg('ben', OWNER, 3)],
      OWNER,
    );
    expect(groups[0].otherUserId).toBe('anna');
    expect(groups[0].messages.map((m) => m.created_at)).toEqual(
      [...groups[0].messages.map((m) => m.created_at)].sort(),
    );
    expect(groups[0].lastMessageAt).toBe(groups[0].messages[1].created_at);
  });

  it('counts only unread messages addressed to me', () => {
    const [g] = groupPostMessages(
      [msg('anna', OWNER, 1), msg('anna', OWNER, 2, true), msg(OWNER, 'anna', 3)],
      OWNER,
    );
    expect(g.unreadCount).toBe(1);
  });

  it('keeps different posts apart', () => {
    const groups = groupPostMessages([msg('anna', OWNER, 1, false, 'p1'), msg('anna', OWNER, 2, false, 'p2')], OWNER);
    expect(groups).toHaveLength(2);
  });
});

describe('selectPostThread / replyRecipient', () => {
  const threads = groupPostMessages(
    [msg('anna', OWNER, 1), msg('ben', OWNER, 2), msg('cleo', OWNER, 3, false, 'p2')],
    OWNER,
  );

  it('answers the chosen sender, not the first one', () => {
    const t = selectPostThread(threads, 'p1', 'anna');
    expect(replyRecipient(t)).toBe('anna');
    expect(threads.filter((x) => x.postId === 'p1')[0].otherUserId).toBe('ben');
  });

  it('needs a choice when several senders wrote and none is chosen', () => {
    expect(selectPostThread(threads, 'p1')).toBeNull();
    expect(replyRecipient(null)).toBeNull();
  });

  it('picks the only conversation automatically', () => {
    expect(replyRecipient(selectPostThread(threads, 'p2'))).toBe('cleo');
  });

  it('returns null for an unknown sender', () => {
    expect(selectPostThread(threads, 'p1', 'cleo')).toBeNull();
  });
});
