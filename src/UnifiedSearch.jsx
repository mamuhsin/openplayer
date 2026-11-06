import OnlineSearch from './OnlineSearch'
export default function UnifiedSearch({latest,setLatest,retry,status,...props}) {
  return <>
    <div className="px-4 md:px-6 pt-5 flex items-center gap-4"><label className="text-sm text-[#b3b3b3]"><input aria-label="Recent music" type="checkbox" checked={latest} onChange={e=>setLatest(e.target.checked)} className="mr-2"/>Recent music</label><button onClick={retry} disabled={props.busy} className="ml-auto rounded-full bg-[#282828] px-4 py-2 text-sm disabled:opacity-50">Refresh results</button></div>
    {status&&<p role="status" className="mx-4 md:mx-6 mt-4 rounded-lg bg-[#242424] p-3 text-sm text-[#b3b3b3]">{status}</p>}
    <OnlineSearch {...props}/>
  </>
}
