// Renders the 10 HUD overlays as ProRes 4444 .mov files with alpha, to lay over the Higgsfield clips.
const {chromium}=(()=>{try{return require('playwright');}catch(e){return require('/opt/node22/lib/node_modules/playwright');}})();
const {execFileSync}=require('child_process');const fs=require('fs'),path=require('path');
const FF=process.env.FFMPEG||'ffmpeg',FPS=30,OUT=path.resolve(__dirname,'out','overlays');fs.mkdirSync(OUT,{recursive:true});
(async()=>{
  const br=await chromium.launch(process.env.CHROME?{executablePath:process.env.CHROME}:{});const pg=await br.newPage({viewport:{width:1920,height:1080}});
  pg.on('pageerror',e=>{console.error('PAGEERR',e.message);process.exit(1);});
  await pg.goto('file://'+path.resolve(__dirname,'overlays.html'));await pg.evaluate(()=>window.ready);
  const only=process.argv[2]?process.argv[2].split(',').map(Number):[...Array(10).keys()];
  for(const i of only){
    const dur=await pg.evaluate(k=>window.setup(k),i),fr=path.join(OUT,'f_'+i);fs.rmSync(fr,{recursive:true,force:true});fs.mkdirSync(fr);
    for(let f=0;f<dur*FPS;f++){await pg.evaluate(t=>window.renderAt(t),f/FPS);await pg.screenshot({path:`${fr}/${String(f).padStart(5,'0')}.png`,omitBackground:true});}
    const n=String(i+1).padStart(2,'0');
    execFileSync(FF,['-y','-loglevel','error','-framerate',String(FPS),'-i',`${fr}/%05d.png`,'-c:v','prores_ks','-profile:v','4444','-pix_fmt','yuva444p10le',path.join(OUT,`hud_${n}.mov`)]);
    fs.rmSync(fr,{recursive:true,force:true});console.log('done',n);
  }
  await br.close();
})();
