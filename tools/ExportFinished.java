import java.io.*;
import java.util.*;
import javax.imageio.ImageIO;
import com.jpexs.decompiler.flash.SWF;
import com.jpexs.decompiler.flash.tags.*;
import com.jpexs.decompiler.flash.timeline.*;
import com.jpexs.decompiler.flash.types.*;
import com.jpexs.decompiler.flash.exporters.commonshape.Matrix;
public class ExportFinished {
 static Map<Integer,List<TreeMap<Integer,DepthState>>> originals=new HashMap<>();
 static void freeze(DefineSpriteTag s,int index){var original=originals.get(s.spriteId).get(index);for(var f:s.getTimeline().getFrames()){f.layers=new TreeMap<>(original);}}
 public static void main(String[] args)throws Exception{
 SWF swf=new SWF(new FileInputStream(args[0]),false);List<DefineSpriteTag> selectors=new ArrayList<>();
 for(var c:swf.getCharacters(false).values())if(c instanceof DefineSpriteTag s){if(s.getTimeline().getFrameWithLabel("human")>=0||s.spriteId==825){selectors.add(s);List<TreeMap<Integer,DepthState>> frames=new ArrayList<>();for(var f:s.getTimeline().getFrames())frames.add(new TreeMap<>(f.layers));originals.put(s.spriteId,frames);}}
 var root=(DefineSpriteTag)swf.getCharacter(834);RECT rect=new RECT();rect.Xmin=-3600;rect.Ymin=-3000;rect.Xmax=3600;rect.Ymax=800;
 for(String line:java.nio.file.Files.readAllLines(java.nio.file.Path.of(args[1]))){String[] parts=line.split(",");String race=parts[0];int unit=Integer.parseInt(parts[1]);
 for(var s:selectors){int f=s.spriteId==825?unit+1:s.spriteId==348?s.getTimeline().getFrameWithLabel(unit==1||unit==31?"buckler":"blank"):s.getTimeline().getFrameWithLabel(race);if(f>=0&&f<s.getFrameCount())freeze(s,f);}
 File out=new File(args[2],race+"-"+unit);out.mkdirs();
 for(int f=0;f<11;f++){var im=SWF.frameToImageGet(root.getTimeline(),f,0,null,0,rect,new Matrix(),new ColorTransform(),null,1,true,0);ImageIO.write(im.getBufferedImage(),"png",new File(out,(f+1)+".png"));}
 System.out.println(race+"-"+unit);
 }
 }
}
