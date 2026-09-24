// The legacy Windows single-player launcher uses a separate port without WebSocket support.
if(location.hostname==='127.0.0.1'&&location.port==='18632'){
 const link=document.querySelector('.coop-entry');if(link)link.href='http://127.0.0.1:18643/coop.html';
}
