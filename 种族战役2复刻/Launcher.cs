using System;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Diagnostics;
using System.Windows.Forms;
using System.Drawing;

class Launcher {
 const int Port=18645;
 static TcpListener listener;
 static string root=AppDomain.CurrentDomain.BaseDirectory;
 static string url="http://127.0.0.1:"+Port+"/";
 static bool stopped=false;
 static void OpenGame(){try{Process.Start(url);}catch(Exception ex){MessageBox.Show("请在浏览器打开："+url+"\n"+ex.Message);}}
 [STAThread] static void Main(string[] args){
  bool fresh;using(var mutex=new Mutex(true,"Warlords2RemakeLocal18645",out fresh)){
   if(!fresh){OpenGame();return;}
   try{listener=new TcpListener(IPAddress.Loopback,Port);listener.Start();}catch(Exception ex){MessageBox.Show("本地启动失败："+ex.Message);return;}
   new Thread(Serve){IsBackground=true}.Start();
   Application.EnableVisualStyles();
   var form=new Form{Text="种族战役2 · 本地启动器",ClientSize=new Size(450,155),FormBorderStyle=FormBorderStyle.FixedDialog,MaximizeBox=false,StartPosition=FormStartPosition.CenterScreen};
   var label=new Label{Text="游戏已在浏览器中打开。\n保持此窗口开启即可游玩，关闭它会停止本地服务。\n全部内容在本机运行，无需联网。",AutoSize=false,Location=new Point(22,18),Size=new Size(415,75)};
   var open=new Button{Text="打开游戏",Location=new Point(22,106),Size=new Size(125,30)};open.Click+=(s,e)=>OpenGame();
   var exit=new Button{Text="退出启动器",Location=new Point(164,106),Size=new Size(125,30)};exit.Click+=(s,e)=>form.Close();
   form.Controls.Add(label);form.Controls.Add(open);form.Controls.Add(exit);
   form.FormClosed+=(s,e)=>{stopped=true;listener.Stop();};
   if(Array.IndexOf(args,"--no-browser")<0)form.Shown+=(s,e)=>OpenGame();
   Application.Run(form);
  }
 }
 static void Serve(){while(!stopped){try{var client=listener.AcceptTcpClient();ThreadPool.QueueUserWorkItem(_=>Handle(client));}catch{if(stopped)return;}}}
 static string Mime(string ext){switch(ext){case ".html":return "text/html; charset=utf-8";case ".js":return "text/javascript; charset=utf-8";case ".css":return "text/css; charset=utf-8";case ".json":return "application/json; charset=utf-8";case ".png":return "image/png";case ".jpg":return "image/jpeg";case ".mp3":return "audio/mpeg";default:return null;}}
 static void Respond(NetworkStream stream,int code,string mime,byte[] data,bool head){
  var hdr=Encoding.ASCII.GetBytes("HTTP/1.1 "+code+" "+(code==200?"OK":"Error")+"\r\nContent-Type: "+mime+"\r\nContent-Length: "+data.Length+"\r\nCache-Control: no-cache\r\nX-Content-Type-Options: nosniff\r\nConnection: close\r\n\r\n");stream.Write(hdr,0,hdr.Length);if(!head)stream.Write(data,0,data.Length);
 }
 static void Handle(TcpClient c){using(c){try{
  c.ReceiveTimeout=3000;c.SendTimeout=5000;var stream=c.GetStream();var reader=new StreamReader(stream,Encoding.ASCII,false,1024,true);
  var first=reader.ReadLine();if(first==null||first.Length>8192)return;var parts=first.Split(' ');if(parts.Length<2)return;
  if(parts[0]!="GET"&&parts[0]!="HEAD"){Respond(stream,405,"text/plain",new byte[0],false);return;}
  int headerBytes=0;string line;while(!string.IsNullOrEmpty(line=reader.ReadLine())){headerBytes+=line.Length;if(headerBytes>16384)return;}
  var relative=Uri.UnescapeDataString(parts[1].Split('?')[0]).TrimStart('/');if(relative=="")relative="index.html";
  var path=Path.GetFullPath(Path.Combine(root,relative.Replace('/',Path.DirectorySeparatorChar)));string mime=Mime(Path.GetExtension(path).ToLowerInvariant());
  if(!path.StartsWith(root,StringComparison.OrdinalIgnoreCase)||mime==null||!File.Exists(path)){Respond(stream,404,"text/plain",Encoding.UTF8.GetBytes("Not found"),false);return;}
  Respond(stream,200,mime,File.ReadAllBytes(path),parts[0]=="HEAD");
 }catch{}}}
}
