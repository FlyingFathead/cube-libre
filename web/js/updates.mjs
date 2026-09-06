// Poll the deployed site's own version file, including project subpaths.
export const UPDATE_INTERVAL_MS=120000;
export function newerVersion(candidate,current) {
  const parse=v=>typeof v==='string'&&/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(v)?v.split('.').map(Number):null;
  const a=parse(candidate),b=parse(current);
  if(!a||!b||![...a,...b].every(Number.isSafeInteger))return false;
  for(let i=0;i<3;i++)if(a[i]!==b[i])return a[i]>b[i];
  return false;
}
export class UpdateChecker {
  constructor(current,{fetcher=globalThis.fetch,url=new URL('../version.json',import.meta.url),now=Date.now}={}) {
    this.current=current;this.fetcher=fetcher;this.url=url;this.now=now;
    this.seen=new Set();this.pending=false;
  }
  async check() {
    if(this.pending)return null;
    this.pending=true;
    try {
      const url=new URL(this.url);url.searchParams.set('check',String(this.now()));
      const response=await this.fetcher(url,{cache:'no-store',signal:AbortSignal.timeout(8000)});
      if(!response.ok)return null;
      const metadata=await response.json(),version=metadata?.version;
      if(metadata?.edition!=='web'||!newerVersion(version,this.current)||this.seen.has(version))return null;
      this.seen.add(version);return version;
    } catch {return null;} // Offline play and transient deployment failures stay quiet.
    finally {this.pending=false;}
  }
}

// Give non-module assets the same release identity as the complete module graph.
export function releaseAssetURL(path,base,version=globalThis.CUBE_LIBRE_RELEASE?.version) {
  const url=new URL(path,base);if(version)url.searchParams.set('v',version);return url;
}
