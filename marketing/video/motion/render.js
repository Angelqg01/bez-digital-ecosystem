const {chromium}=require('/opt/node22/lib/node_modules/playwright');
const {execFileSync}=require('child_process');const fs=require('fs'),path=require('path');
const FF=process.env.FFMPEG,FPS=30,OUT=path.resolve(__dirname,'out');fs.mkdirSync(OUT,{recursive:true});
(async()=>{
 const only=process.argv[2]?process.argv[2].split(''):['A','B','C','D','E','F','G','H','I','J'];
 const br=await chromium.launch({executablePath:process.env.CHROME});const pg=await br.newPage({viewport:{width:1920,height:1080}});
 pg.on('pageerror',e=>{console.error('PAGEERR',e.message);process.exit(1)});
 await pg.goto('file://'+path.resolve(__dirname,'scenes.html'));
 for(const id of only){
  const dur=await pg.evaluate(i=>window.setup(i),id);const fr=path.join(OUT,'f_'+id);fs.rmSync(fr,{recursive:true,force:true});fs.mkdirSync(fr);
  const n=Math.round(dur*FPS);
  for(let i=0;i<n;i++){await pg.evaluate(t=>window.renderAt(t),i/FPS);await pg.screenshot({path:`${fr}/${String(i).padStart(5,'0')}.jpg`,type:'jpeg',quality:92});}
  execFileSync(FF,['-y','-loglevel','error','-framerate',String(FPS),'-i',`${fr}/%05d.jpg`,'-c:v','libx264','-pix_fmt','yuv420p','-crf','16',path.join(OUT,`escena_${id}.mp4`)]);
  fs.rmSync(fr,{recursive:true,force:true});console.log('done',id,dur+'s');
 }
 await br.close();
})();
