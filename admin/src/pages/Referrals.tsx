import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { date } from '../format';
import { Empty, ErrorBox, Loading, PageHead, Pager, useDebounced, useFetch } from '../ui';

type ReferralRow = {
  inviteeId: string; inviteeName: string | null; inviteeMobile: string; referredAt: string; joined: boolean;
  referrerId: string; referrerName: string | null; referrerMobile: string; referralCode: string | null;
};
type Data = {
  items: ReferralRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number; hasNext: boolean; hasPrev: boolean };
  target: number; rewardTa: string; rewardEn: string;
};

export default function Referrals() {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const dq = useDebounced(q);
  const { data, error, loading, reload } = useFetch<Data>('/admin/referrals', { q: dq, page, limit: 20 });

  return (
    <>
      <PageHead title="Referrals" sub="See who referred each customer and whether the referral qualifies for the reward." />
      <div className="info" style={{ marginBottom: 14 }}>
        A referral qualifies when the invited customer uses a referral code and joins any plan. The referrer becomes eligible for the active scheme reward after {data?.target ?? 5} qualified referrals.
        {(data?.rewardEn || data?.rewardTa) && <span style={{ display: 'block', marginTop: 4 }}>Reward: {data.rewardEn || data.rewardTa}</span>}
      </div>
      <div className="toolbar">
        <input className="search" placeholder="Search either customer, mobile, or referral code…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
      </div>
      <div className="card flush">
        {loading && !data ? <Loading /> : error ? <ErrorBox message={error} retry={reload} /> : !data?.items.length ? <Empty text="No referrals found." /> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Referrer</th><th>Referred customer</th><th>Qualification</th><th>Referred on</th></tr></thead>
            <tbody>{data.items.map((r) => (
              <tr key={r.inviteeId}>
                <td><Link to={`/customers/${r.referrerId}`}><b>{r.referrerName ?? 'Deleted customer'}</b></Link><span className="sub">{r.referrerMobile}{r.referralCode ? ` · ${r.referralCode}` : ''}</span></td>
                <td><Link to={`/customers/${r.inviteeId}`}><b>{r.inviteeName ?? 'Deleted customer'}</b></Link><span className="sub">{r.inviteeMobile}</span></td>
                <td><span className={`badge ${r.joined ? 'green' : 'grey'}`}>{r.joined ? 'Joined a plan' : 'Has not joined a plan'}</span></td>
                <td>{date(r.referredAt)}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
        <Pager p={data?.pagination} onPage={setPage} />
      </div>
    </>
  );
}
