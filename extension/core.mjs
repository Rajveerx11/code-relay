export function validateScope(current, approved, consent) {
  if (!consent) return {ok:false, error:'Confirm that external-code import is permitted on this practice page.'};
  try {
    const url = new URL(current);
    const local = url.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname);
    if ((url.protocol !== 'https:' && !local) || url.username || url.password) throw new Error();
    if (current !== approved) return {ok:false, error:'The page changed. Approve its exact current URL again.'};
    if (/(exam|assessment|proctor|secure[-_]?test|quiz)/i.test(url.pathname + url.search + url.hash))
      return {ok:false, error:'Assessment/proctoring pages are not supported.'};
    return {ok:true};
  } catch { return {ok:false, error:'Use an HTTPS practice page (or the localhost demo), without embedded credentials.'}; }
}
