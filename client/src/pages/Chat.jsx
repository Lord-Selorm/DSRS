import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { FiSend, FiMessageSquare, FiShield, FiHash, FiUsers } from 'react-icons/fi';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

function parseTime(value) {
  const d = new Date(String(value || '').replace('T', ' ').replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function dayLabel(value) {
  const d = new Date(String(value || '').replace('T', ' ').replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  const ymd = (x) => `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
  if (ymd(d) === ymd(today)) return 'Today';
  const yesterday = new Date(today.getTime() - 86400000);
  if (ymd(d) === ymd(yesterday)) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function mergeMsgs(prev, incoming) {
  const seen = new Set(prev.map((m) => Number(m.id)));
  const next = prev.slice();
  for (const m of incoming) {
    if (m && !seen.has(Number(m.id))) {
      seen.add(Number(m.id));
      next.push(m);
    }
  }
  return next.sort((a, b) => Number(a.id) - Number(b.id));
}

export default function Chat() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const channels = useMemo(() => (isAdmin ? ['general', 'management'] : ['general']), [isAdmin]);

  const [channel, setChannel] = useState('general');
  const [msgs, setMsgs] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const msgsRef = useRef([]);
  const channelRef = useRef('general');
  const scrollRef = useRef(null);
  const stickBottomRef = useRef(true);
  const firstLoadRef = useRef(true);

  useEffect(() => { channelRef.current = channel; }, [channel]);
  useEffect(() => { msgsRef.current = msgs; }, [msgs]);

  const maxId = (list) => (list.length ? Math.max(...list.map((m) => Number(m.id))) : 0);

  const markRead = async (ch) => {
    const list = msgsRef.current.filter((m) => m.channel === ch);
    const last = maxId(list);
    if (last <= 0) return;
    try { await api.post('/chat/read', { channel: ch, last_read_id: last }); } catch { /* best effort */ }
  };

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const after = maxId(msgsRef.current);
        const { data } = await api.get('/chat/messages', { params: { after, limit: 300 } });
        if (!alive || !Array.isArray(data) || !data.length) return;
        setMsgs((prev) => mergeMsgs(prev, data));
        if (data.some((m) => m.channel === channelRef.current)) markRead(channelRef.current);
      } catch { /* server may be offline on desktop */ }
    };
    (async () => {
      try {
        const { data } = await api.get('/chat/messages', { params: { after: 0, limit: 300 } });
        if (alive && Array.isArray(data)) {
          msgsRef.current = data.sort((a, b) => Number(a.id) - Number(b.id));
          setMsgs(msgsRef.current);
          markRead(channelRef.current);
        }
      } catch { /* ignore */ } finally {
        if (alive) setLoading(false);
      }
      if (alive) tick();
    })();
    const t = setInterval(tick, 5000);
    return () => { alive = false; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channels]);

  // Keep the view pinned to the newest message unless the user scrolled up.
  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [msgs, channel]);

  useEffect(() => { if (!firstLoadRef.current) markRead(channel); }, [channel]);
  useEffect(() => { firstLoadRef.current = false; }, []);

  const send = async (e) => {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const { data } = await api.post('/chat/messages', { channel: channelRef.current, text });
      setMsgs((prev) => mergeMsgs(prev, [data]));
      setDraft('');
      stickBottomRef.current = true;
      markRead(channelRef.current);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Message not sent');
    } finally {
      setSending(false);
    }
  };

  const visible = msgs.filter((m) => m.channel === channel);
  const myName = user?.username;

  return (
    <div className="p-6 h-full flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3 shrink-0">
        <div>
          <h1 className="page-title flex items-center gap-2"><FiMessageSquare className="text-brand-600" size={20} /> Messages</h1>
          <p className="text-sm text-slate-500 mt-0.5 dark:text-slate-400">Coordination &amp; notice-board chat — synced to the registry</p>
        </div>
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl dark:bg-slate-800">
          {channels.map((ch) => (
            <button
              key={ch}
              onClick={() => setChannel(ch)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                channel === ch ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-700 dark:text-brand-200' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              {ch === 'management' ? <FiShield size={14} /> : <FiHash size={14} />}
              {ch === 'management' ? 'Management' : 'General'}
              <span className="text-[10px] text-slate-400 dark:text-slate-500 hidden sm:inline">
                {ch === 'management' ? <FiUsers size={13} /> : <FiUsers size={12} />}
              </span>
            </button>
          ))}
        </div>
      </div>

      <section className="card flex-1 min-h-0 overflow-hidden flex flex-col">
        {/* Messages */}
        <div ref={scrollRef} onScroll={onScroll} className="flex-1 min-h-0 overflow-y-auto scrollbar-thin bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-900">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <span className="w-5 h-5 border-2 border-slate-300 dark:border-slate-600 border-t-brand-600 rounded-full animate-spin" />
            </div>
          ) : visible.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <div className="w-14 h-14 rounded-full bg-brand-50 flex items-center justify-center mb-3 dark:bg-brand-500/15">
                <FiMessageSquare size={24} className="text-brand-600 dark:text-brand-300" />
              </div>
              <p className="font-medium text-slate-600 dark:text-slate-300">No messages yet</p>
              <p className="text-sm text-slate-400 mt-1 dark:text-slate-500">Start the conversation — messages sync to every connected device.</p>
            </div>
          ) : (
            <div className="px-4 sm:px-6 py-4 space-y-1 max-w-4xl mx-auto">
              {visible.map((m, i) => {
                const mine = m.sender === myName;
                const showDay = i === 0 || dayLabel(m.created_at) !== dayLabel(visible[i - 1].created_at);
                const showName = !mine && (i === 0 || visible[i - 1].sender !== m.sender);
                return (
                  <div key={m.id}>
                    {showDay && (
                      <div className="flex justify-center my-3">
                        <span className="text-[10px] uppercase tracking-wide bg-white border border-slate-200 text-slate-400 px-2.5 py-0.5 rounded-full dark:bg-slate-800 dark:border-slate-700 dark:text-slate-500">
                          {dayLabel(m.created_at)}
                        </span>
                      </div>
                    )}
                    {showName && (
                      <div className="flex justify-start mt-2 mb-0.5">
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{m.sender_name || m.sender}</span>
                      </div>
                    )}
                    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[78%] sm:max-w-[65%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
                        mine
                          ? 'bg-brand-600 text-white rounded-br-md'
                          : 'bg-white border border-slate-200 text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 rounded-bl-md'
                      }`}>
                        <p className="whitespace-pre-wrap break-words leading-relaxed">{m.text}</p>
                        <p className={`text-[10px] mt-0.5 ${mine ? 'text-white/70' : 'text-slate-400 dark:text-slate-500'}`}>{parseTime(m.created_at)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Composer */}
        <form onSubmit={send} className="shrink-0 border-t border-slate-200 p-3 sm:p-4 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-end gap-2 max-w-4xl mx-auto">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder={`Message ${channel === 'management' ? 'the management channel' : 'the general channel'}…`}
              className="input min-h-[46px] max-h-32 resize-y"
            />
            <button type="submit" disabled={sending || !draft.trim()} className="btn-primary !px-4 !py-3 h-[46px] shrink-0" title="Send">
              {sending ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <FiSend size={16} />}
            </button>
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5 max-w-4xl mx-auto dark:text-slate-500">
            Enter to send · Shift+Enter for a new line{isAdmin ? ' · as Manager you also see the management channel' : ''}
          </p>
        </form>
      </section>
    </div>
  );
}