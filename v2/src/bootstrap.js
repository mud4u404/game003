const room=new URLSearchParams(location.search).get('scene')==='clinic-room';
import(room?'./clinic-room.js':'./app.js').catch(error=>{document.querySelector('#banner').hidden=false;document.querySelector('#banner').textContent='加载失败：'+error.message;});
