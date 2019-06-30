/* NES PPU aka 2C02 */

class nesPPU
{
    constructor(vromarr,romLdr)
    {
        this.vromArray=vromarr;
        this.romLoader=romLdr;

        this.nameTable=new Array(0x1000); // name & attribute tables
        for (var b=0;b<0x1000;b++)
        {
            this.nameTable[b]=0;
        }

        this.palette=new Array(0x20);
        for (var b=0;b<0x20;b++)
        {
            this.palette[b]=0;
        }

        this.sprram=new Array(0x100);
        for (var b=0;b<0x100;b++)
        {
            this.sprram[b]=0;
        }
        
        // PAL standard
        this.nesScreenX=256;
        this.nesScreenY=240;

        this.ppuLeastSignBits=0;

        this.ppuctrl=0; // ppu control register at 0x2000
        this.ppumask=0; // ppu mask at 0x2001
        this.ppustatus=0; // ppu status at 0x2002
        this.ppuoamaddr=0; // ppu OAM address

        this.ppuscroll=0; // ppu scroll at 0x2005
        this.scrollx=0;
        this.scrolly=0;
        
        this.ppuaddress=0; // ppu address at 0x2006
        this.ppuAddressLowByte=0;
        this.ppuAddressHighByte=0;
        this.ppuAddressAdder=0;

        this.ppudata=0; // ppu data at 0x2007
        this.ppudataReadBuffer=0;

        this.ppuAddressLatch=0;

        // Each scanline lasts for 341 PPU clock cycles
        this.ppuCyclesPerScanline=341;
        this.ppuScanlines=262;
        this.vblankLine=241;
        this.vblankSignaled=false;
        this.ppuCyclesCounter=0;

        this.pixelNumber=0;
        this.scanlineNumber=0;
        this.frameNumber=0;
        this.ppuNMIcounter=0;

        this.oldCPUCycles=0;

        //

        this.nesPalette=[
        [84,  84,  84],[0,  30, 116],[8,  16, 144],[   48,   0, 136],[   68,   0, 100],[   92,   0,  48],[   84,   4,   0],[   60,  24,   0],[   32,  42,   0],[    8,  58,   0],[    0,  64,   0],[    0,  60 ,  0],[    0,  50,  60],[    0,   0,   0],[0,0,0],[0,0,0],
        [152, 150, 152],[8,  76, 196],[48,  50, 236],[   92,  30, 228],[  136,  20, 176],[  160,  20, 100],[  152,  34,  32],[  120,  60,   0],[   84,  90,   0],[   40, 114,   0],[    8, 124,   0],[    0, 118,  40],[    0, 102, 120],[    0,   0,   0],[0,0,0],[0,0,0],
        [236, 238, 236],[76, 154, 236],[120, 124, 236],[  176,  98, 236],[  228,  84, 236],[  236,  88, 180],[  236, 106, 100],[  212, 136,  32],[  160, 170,   0],[  116, 196,   0],[   76, 208,  32],[   56, 204, 108],[   56, 180, 204],[   60,  60,  60],[0,0,0],[0,0,0],
        [236, 238, 236],[168, 204, 236],[188, 188, 236],[  212, 178, 236],[  236, 174, 236],[  236, 174, 212],[  236, 180, 176],[  228, 196, 144],[  204, 210, 120],[  180, 222, 120],[  168, 226, 144],[  152, 226, 180],[  160, 214, 228],[  160, 162, 160],[0,0,0],[0,0,0]
        ];

        this.palArr=new Array(4);
        this.ppuByteLookup=new Array();

        for (var b0=0;b0<256;b0++)
        {
            var a2=new Array(8);
            for (var x=0;x<8;x++)
            {
                var resBit=(((b0&(1<<(7-x)))>>(7-x))&0x01);
                a2[x]=resBit;
            }

            this.ppuByteLookup.push(a2);
        }

        this.frameBuffer=new Uint8ClampedArray(this.nesScreenY*this.nesScreenX*4); // RGBA framebuffer
        for (var i=0;i<(this.nesScreenX*this.nesScreenY*4);i++)
        {
            this.frameBuffer[i]=255;
        }
    }

    setCPU(theCpu)
    {
        this.cpu=theCpu;
    }

    drawDebugInfo(canvasName,px,py)
    {
        var canvas = document.getElementById(canvasName);
        var ctx = canvas.getContext("2d");

        ctx.fillColor="white";
        ctx.clearRect(px,py,300,200);        

        ctx.fillStyle="black";
        ctx.fillText("PPU control reg 0x2000: 0x"+this.ppuctrl.toString(16),px,py);
        ctx.fillText("PPU Status reg 0x2002: 0x"+this.ppustatus.toString(16),px,py+20);
        ctx.fillText("VRAM write address: 0x"+((this.ppuAddressLowByte|(this.ppuAddressHighByte<<8))+this.ppuAddressAdder).toString(16),px,py+20*2);
        ctx.fillText("SL: "+this.scanlineNumber+" Frame: "+this.frameNumber,px,py+20*3);
        ctx.fillText("scrlx: "+this.scrollx+" scrly: "+this.scrolly,px,py+20*4);

        // background palette

        for (var p=0;p<0x10;p++)
        {
            var palz=this.palette[p];
            ctx.fillStyle="rgb("+this.nesPalette[palz][0]+","+this.nesPalette[palz][1]+","+this.nesPalette[palz][2]+")";
            ctx.fillRect(px+270,110+py+(p*8),7,7);            
        }
    }

    step(numCPUCycles,cpuz,pozsx,pozsy,doubled)
    {
        const totCPUcycles=numCPUCycles-this.oldCPUCycles;

        const numPPUcycles=totCPUcycles*3;
        this.oldCPUCycles+=totCPUcycles;
        this.ppuCyclesCounter+=numPPUcycles;

        if (this.ppuNMIcounter>0)
        {
            this.ppuNMIcounter-=numPPUcycles;
            if (this.ppuNMIcounter<=0)
            {
                this.ppustatus&=0x7f; // clear bit 7
            }
        }

        this.pixelNumber+=numPPUcycles;
        if (this.pixelNumber>=this.ppuCyclesPerScanline)
        {
            // trigger rendering of scanline 

            this.scanlineRenderer(this.scanlineNumber);

            this.pixelNumber%=this.ppuCyclesPerScanline;
            this.scanlineNumber+=1;

            if (this.scanlineNumber>=this.ppuScanlines)
            {
                this.scanlineNumber=0;
                this.vblankSignaled=false;
                //this.ppustatus&=0x7f; // not in vblank anymore
                this.frameNumber+=1;
            }
            else if (this.scanlineNumber==this.vblankLine)
            {
                if (!this.vblankSignaled)
                {
                    // update register 0x2002
                    this.ppustatus|=0x80;
                    this.vblankSignaled=true;

                    // trigger NMI?
                    if (this.ppuctrl&0x80)
                    {
                        //alert("PPU triggers NMI. We are at "+this.ppuCyclesCounter+" cycles and frame "+this.frameNumber);
                        this.cpu.NMI();
                        this.ppuNMIcounter=6820;
                    }
                }
            }
        }
    
        // HACK TODO sprite 0 hit
        //var ypos=this.sprram[0];
        if (this.scanlineNumber==32) this.ppustatus|=0x40;
        if (this.scanlineNumber==0) this.ppustatus&=~0x40;
        
    }

    drawSprites16(px,py)
    {
        for (var s=63;s>=0;s--)
        {
            var oambyte0=this.sprram[s*4];
            var oambyte1=this.sprram[s*4+1];
            var oambyte2=this.sprram[s*4+2];
            var oambyte3=this.sprram[s*4+3];

            var patternTableAdder=((oambyte1&0x01)!=0)?0x1000:0x0;

            var ypos=oambyte0;
            var xpos=oambyte3;
            var palnum=oambyte2&0x03;

            if (ypos<0xef)
            {
                //the sprite palette ($3F10-$3F1F)

                this.palArr[0]=this.nesPalette[this.palette[0x10+(palnum*4)+0]];
                this.palArr[1]=this.nesPalette[this.palette[0x10+(palnum*4)+1]];
                this.palArr[2]=this.nesPalette[this.palette[0x10+(palnum*4)+2]];
                this.palArr[3]=this.nesPalette[this.palette[0x10+(palnum*4)+3]];

                var sprnum=(oambyte1)&0xfe;
                var baseAddr=sprnum*16;
                var flipSpriteHorz=(oambyte2&0x40)?true:false;
                var flipSpriteVert=(oambyte2&0x80)?true:false;

                // upper half

                for (var y=0;y<8;y++)
                {
                    var pozz=((y+ypos)*4*this.nesScreenX)+(4*xpos);

                    if (!flipSpriteVert)
                    {
                        var byte0=this.vromArray[patternTableAdder+baseAddr+y];
                        var byte1=this.vromArray[patternTableAdder+baseAddr+y+8];
                    }
                    else
                    {
                        var byte0=this.vromArray[patternTableAdder+baseAddr+7-y];
                        var byte1=this.vromArray[patternTableAdder+baseAddr+7-y+8];
                    }

                    for (var x=0;x<8;x++)
                    {
                        if (!flipSpriteHorz)
                        {
                            var byte0bit=((byte0&(1<<(7-x)))>>(7-x))&0x01;
                            var byte1bit=((byte1&(1<<(7-x)))>>(7-x))&0x01;
                        }
                        else
                        {
                            var byte0bit=((byte0&(1<<(x)))>>(x))&0x01;
                            var byte1bit=((byte1&(1<<(x)))>>(x))&0x01;
                        }
        
                        var resBit=byte0bit|(byte1bit<<1);

                        if (resBit!=0)
                        {
                            this.frameBuffer[pozz+0]=this.palArr[resBit][0];
                            this.frameBuffer[pozz+1]=this.palArr[resBit][1];
                            this.frameBuffer[pozz+2]=this.palArr[resBit][2];
                        }

                        pozz+=4;
                    }
                }

                // lower half

                baseAddr=(sprnum+1)*16;

                for (var y=0;y<8;y++)
                {
                    var pozz=((8+y+ypos)*4*this.nesScreenX)+(4*xpos);

                    if (!flipSpriteVert)
                    {
                        var byte0=this.vromArray[patternTableAdder+baseAddr+y];
                        var byte1=this.vromArray[patternTableAdder+baseAddr+y+8];
                    }
                    else
                    {
                        var byte0=this.vromArray[patternTableAdder+baseAddr+7-y];
                        var byte1=this.vromArray[patternTableAdder+baseAddr+7-y+8];
                    }

                    for (var x=0;x<8;x++)
                    {
                        if (!flipSpriteHorz)
                        {
                            var byte0bit=((byte0&(1<<(7-x)))>>(7-x))&0x01;
                            var byte1bit=((byte1&(1<<(7-x)))>>(7-x))&0x01;
                        }
                        else
                        {
                            var byte0bit=((byte0&(1<<(x)))>>(x))&0x01;
                            var byte1bit=((byte1&(1<<(x)))>>(x))&0x01;
                        }
        
                        var resBit=byte0bit|(byte1bit<<1);

                        if (resBit!=0)
                        {
                            this.frameBuffer[pozz+0]=this.palArr[resBit][0];
                            this.frameBuffer[pozz+1]=this.palArr[resBit][1];
                            this.frameBuffer[pozz+2]=this.palArr[resBit][2];
                        }

                        pozz+=4;
                    }
                }
            }
    
        }
    }

    drawSprites8(px,py)
    {
        var patternTableAdder=((this.ppuctrl&0x08)!=0)?0x1000:0x0;

        for (var s=63;s>=0;s--)
        {
            var oambyte0=this.sprram[s*4];
            var oambyte1=this.sprram[s*4+1];
            var oambyte2=this.sprram[s*4+2];
            var oambyte3=this.sprram[s*4+3];

            var ypos=oambyte0;
            var xpos=oambyte3;
            var palnum=oambyte2&0x03;

            if (ypos<0xef) // ??????
            {
                //the sprite palette ($3F10-$3F1F)

                this.palArr[0]=this.nesPalette[this.palette[0x10+(palnum*4)+0]];
                this.palArr[1]=this.nesPalette[this.palette[0x10+(palnum*4)+1]];
                this.palArr[2]=this.nesPalette[this.palette[0x10+(palnum*4)+2]];
                this.palArr[3]=this.nesPalette[this.palette[0x10+(palnum*4)+3]];
        
                var sprnum=oambyte1;
                var baseAddr=sprnum*16;
                var flipSpriteHorz=(oambyte2&0x40)?true:false;
                var flipSpriteVert=(oambyte2&0x80)?true:false;

                for (var y=0;y<8;y++)
                {
                    if (!flipSpriteVert)
                    {
                        var byte0=this.vromArray[patternTableAdder+baseAddr+y];
                        var byte1=this.vromArray[patternTableAdder+baseAddr+y+8];
                    }
                    else
                    {
                        var byte0=this.vromArray[patternTableAdder+baseAddr+7-y];
                        var byte1=this.vromArray[patternTableAdder+baseAddr+8+7-y];
                    }

                    var pozz=((y+ypos)*4*this.nesScreenX)+(4*xpos);
                    for (var x=0;x<8;x++)
                    {
                        if ((x+xpos)<0xff)
                        {
                            if (!flipSpriteHorz)
                            {
                                var byte0bit=((byte0&(1<<(7-x)))>>(7-x))&0x01;
                                var byte1bit=((byte1&(1<<(7-x)))>>(7-x))&0x01;
                            }
                            else
                            {
                                var byte0bit=((byte0&(1<<(x)))>>(x))&0x01;
                                var byte1bit=((byte1&(1<<(x)))>>(x))&0x01;
                            }
            
                            var resBit=byte0bit|(byte1bit<<1);

                            if (resBit!=0)
                            {
                                this.frameBuffer[pozz+0]=this.palArr[resBit][0];
                                this.frameBuffer[pozz+1]=this.palArr[resBit][1];
                                this.frameBuffer[pozz+2]=this.palArr[resBit][2];
                            }
                        }

                        pozz+=4;
                    }
                }
            }
    
        }
    }

    drawTileNum(canvasName,px,py,tileNum,palnum,doubled)
    {
        var canvas = document.getElementById(canvasName);
        var ctx = canvas.getContext("2d");

        var baseAddr=tileNum*16;

        var backColor="rgb("+this.nesPalette[this.palette[0]][0]+","+this.nesPalette[this.palette[0]][1]+","+this.nesPalette[this.palette[0]][2]+")";
        var colorz=new Array(3);
        try
        {
            var p1=this.nesPalette[this.palette[(palnum*4)+1]];
            var p2=this.nesPalette[this.palette[(palnum*4)+2]];
            var p3=this.nesPalette[this.palette[(palnum*4)+3]];

            colorz[0]="rgb("+p1[0]+","+p1[1]+","+p1[2]+")";
            colorz[1]="rgb("+p2[0]+","+p2[1]+","+p2[2]+")";
            colorz[2]="rgb("+p3[0]+","+p3[1]+","+p3[2]+")";
        }
        catch(e)
        {
            alert("Invalid palette");
        }

        var patternTableAdder=((this.ppuctrl&0x10)!=0)?0x1000:0x0;

        var multiplier=1;
        if (doubled) multiplier=2;
        for (var y=0;y<8;y+=1)
        {
            var byte0=this.vromArray[patternTableAdder+baseAddr+y];
            var byte1=this.vromArray[patternTableAdder+baseAddr+y+8];
            for (var x=0;x<8;x+=1)
            {
                var byte0bit=((byte0&(1<<(7-x)))>>(7-x))&0x01;
                var byte1bit=((byte1&(1<<(7-x)))>>(7-x))&0x01;

                var resBit=byte0bit|(byte1bit<<1);

                if (resBit==0)
                {
                    ctx.fillStyle=backColor;
                    ctx.fillRect(px+x*multiplier,py+y*multiplier,multiplier,multiplier);
                }
                else
                {
                    ctx.fillStyle=colorz[resBit-1];
                    ctx.fillRect(px+x*multiplier,py+y*multiplier,multiplier,multiplier);
                }        
            }
        }
    }

    getPaletteAttributes(tilex,tiley)
    {
        var palnum;

        tilex=Math.floor(tilex/2);
        tiley=Math.floor(tiley/2);

        var attributeTableIdx=Math.floor(tilex/2)+(Math.floor(tiley/2)*(this.nesScreenX/32));
        attributeTableIdx+=0x3c0;

        if (((tilex%2)==0)&&((tiley%2)==0))
        {
            palnum=(this.nameTable[attributeTableIdx])&0x3;
        }
        else if (((tilex%2)==1)&&((tiley%2)==0))
        {
            palnum=(this.nameTable[attributeTableIdx]>>2)&0x3;
        }
        else if (((tilex%2)==0)&&((tiley%2)==1))
        {
            palnum=(this.nameTable[attributeTableIdx]>>4)&0x3;
        }
        else if (((tilex%2)==1)&&((tiley%2)==1))
        {
            palnum=(this.nameTable[attributeTableIdx]>>6)&0x3;
        }

        return palnum;
    }

    drawScanlineTile(px,py,tnum,palnum,doubled,inix)
    {
        var baseAddr=tnum*16;

        this.palArr[0]=[this.nesPalette[this.palette[0]][0],this.nesPalette[this.palette[0]][1],this.nesPalette[this.palette[0]][2]];
        this.palArr[1]=this.nesPalette[this.palette[(palnum*4)+1]];
        this.palArr[2]=this.nesPalette[this.palette[(palnum*4)+2]];
        this.palArr[3]=this.nesPalette[this.palette[(palnum*4)+3]];

        var patternTableAdder=((this.ppuctrl&0x10)!=0)?0x1000:0x0;

        var by=py&0x07;
        var byte0=this.vromArray[patternTableAdder+baseAddr+by];
        var byte1=this.vromArray[patternTableAdder+baseAddr+by+8];

        var pozz=4*(py*this.nesScreenX+px);
        for (var x=inix;x<8;x++)
        {
            //if ((x+px)>=this.nesScreenX) return;

            //var resBit=(((byte0&(1<<(7-x)))>>(7-x))&0x01)|((((byte1&(1<<(7-x)))>>(7-x))&0x01)<<1);
            var resBit=this.ppuByteLookup[byte0][x]|(this.ppuByteLookup[byte1][x]<<1);

            this.frameBuffer[pozz]=this.palArr[resBit][0];
            this.frameBuffer[pozz+1]=this.palArr[resBit][1];
            this.frameBuffer[pozz+2]=this.palArr[resBit][2];
            
            pozz+=4;
        }
    }

    getPaletteAttributesScanline(tilex,tiley,add)
    {
        var palnum;

        tilex=Math.floor((tilex%32)/2);
        tiley=Math.floor(tiley/2);

        var attributeTableIdx=0;
        attributeTableIdx+=Math.floor((tilex)/2)+(Math.floor(tiley/2)*(this.nesScreenX/32))+0x3c0+add;

        if (((tilex%2)==0)&&((tiley%2)==0))
        {
            palnum=(this.nameTable[attributeTableIdx])&0x3;
        }
        else if (((tilex%2)==1)&&((tiley%2)==0))
        {
            palnum=(this.nameTable[attributeTableIdx]>>2)&0x3;
        }
        else if (((tilex%2)==0)&&((tiley%2)==1))
        {
            palnum=(this.nameTable[attributeTableIdx]>>4)&0x3;
        }
        else if (((tilex%2)==1)&&((tiley%2)==1))
        {
            palnum=(this.nameTable[attributeTableIdx]>>6)&0x3;
        }

        return palnum;
    }

    scanlineRenderer(slnum)
    {
        //if (this.frameNumber<800) return;
        //if (!(this.frameNumber%5==0)) return;
        if ((slnum<1)||(slnum>240)) return;

        slnum-=1;

        // if background renderer enabled
        if (this.ppumask&0x08)
        {
            var realy=slnum;

            var adderz=0;
            var whichNametable=this.ppuctrl&0x03;

            if (this.romLoader.mirroring==1)
            {
                if (whichNametable==0) adderz=0;
                else adderz=0x400;
            }
            else
            {
                if (whichNametable==0) adderz=0;
                else adderz=0x800;
            }
    
            var tiley;

            if (this.romLoader.mirroring==1)
            {
                tiley=Math.floor(slnum/8);
            }
            else
            {
                tiley=Math.floor((slnum+this.scrolly)/8);
            }

            var xpos=this.scrollx;
            var xpixel=0;
            while (xpixel<this.nesScreenX)
            {
                var paletteNum=0;
                var tileNum;
                
                if (this.romLoader.mirroring==1)
                {
                    // horizontal mirroring - super mario
                    if (xpos<this.nesScreenX)
                    {
                        tileNum=this.nameTable[((adderz+Math.floor(xpos/8)))+(tiley*(this.nesScreenX/8))];
                        paletteNum=this.getPaletteAttributesScanline(Math.floor(xpos/8),tiley,adderz)
                    }
                    else
                    {
                        tileNum=this.nameTable[((0x400-32-adderz+Math.floor(xpos/8)))+(tiley*(this.nesScreenX/8))];
                        paletteNum=this.getPaletteAttributesScanline(Math.floor(xpos/8),tiley,0x400-adderz)
                    }
                }
                else
                {
                    // vertical mirroring
                    tileNum=this.nameTable[((adderz+Math.floor(xpos/8)))+(tiley*(this.nesScreenX/8))];
                    paletteNum=this.getPaletteAttributesScanline(Math.floor(xpos/8),tiley,adderz)
                }

                if ((xpixel==0)&&((this.scrollx%8)!=0))
                {
                    this.drawScanlineTile(xpixel,realy,tileNum,paletteNum,false,this.scrollx%8);
                    xpos+=8-this.scrollx%8;
                    xpixel+=8-this.scrollx%8;
                }
                else
                {
                    this.drawScanlineTile(xpixel,realy,tileNum,paletteNum,false,0);
                    xpos+=8;
                    xpixel+=8;
                }

            }
        }

        if (slnum==239)
        {
            // sprites

            if (this.ppumask&0x10)
            {
                if (this.ppuctrl&0x20)
                {
                    // sprites 8x16
                    this.drawSprites16(0,0,false);
                }
                else
                {
                    // sprites 8x8
                    this.drawSprites8(0,0,false);
                }
            }

            var canvas = document.getElementById("mainCanvass");
            var ctx = canvas.getContext("2d");
            var imgData = ctx.getImageData(0, 0, 256, 240);
            imgData.data.set(this.frameBuffer);
            //ctx.putImageData(imgData, 0, 0);

            var renderer = document.createElement('canvas');
            renderer.width = imgData.width;
            renderer.height = imgData.height;
            renderer.getContext('2d').putImageData(imgData, 0, 0);
            ctx.drawImage(renderer, 0,0, 512, 240*2);
        }
    }

    simpleRenderer(canvasName,px,py,doubled)
    {
        // background 

        var multiplier=8;
        if (doubled) multiplier=16;
        if (this.ppumask&0x08)
        {
            for (var y=0;y<(this.nesScreenY/8);y++)
            {
                for (var x=0;x<(this.nesScreenX/8);x++)
                {
                    var paletteNum=this.getPaletteAttributes(x,y);
                    var tileNum=this.nameTable[x+(y*(this.nesScreenX/8))];
                    this.drawTileNum(canvasName,px+(x*multiplier),py+(y*multiplier),tileNum,paletteNum,doubled);
                }
            }
        }

        // sprites

        if (this.ppumask&0x10)
        {
            if (this.ppuctrl&0x20)
            {
                // sprites 8x16
                this.drawSprites16(canvasName,px,py);
            }
            else
            {
                this.drawSprites8(canvasName,px,py);
            }
        }
    }

    // 0x2002
    getPPUstatusRegister()
    {
        this.ppustatus=this.ppustatus|this.ppuLeastSignBits;
        //console.log("Read from PPU status register:"+this.ppustatus.toString(16))
        var retval=this.ppustatus;
        this.ppustatus&=0x7f; // reading from PPU status register clears bit 7
        this.ppuAddressLatch=0;
        return retval;
    }

    // 0x2004
    getPPUdata0x2004()
    {
        return this.sprram[this.ppuoamaddr];
    }

    getPPUDATA0x2007()
    {
        // TODO: nuovo check su valori di ritorno 

        var address=this.ppuAddressLowByte|(this.ppuAddressHighByte<<8);
        address+=this.ppuAddressAdder;

        var retval;

        if (address <= 0x3eff)
        {
            retval=this.ppudataReadBuffer;

            if ((address>=0)&&(address<0x2000))
            {
                this.ppudataReadBuffer=this.vromArray[address];
            }
            else if ((address>=0x2000)&&(address<0x3f00))
            {
                var realAddress=address-0x2000;
                realAddress%=0x1000;
                
                this.ppudataReadBuffer=this.nameTable[realAddress];
            }            
        }
        else if ((address>=0x3f00)&&(address<=0x3fff))
        {
            var realAddress=address-0x3f00;
            realAddress%=0x20;

            retval=this.palette[realAddress];

            var realAddressbuffer=address-0x2000;
            realAddressbuffer%=0x1000;
            this.ppudataReadBuffer=this.nameTable[realAddressbuffer]; // the famous "underneath" nametable

            // Addresses $3F10/$3F14/$3F18/$3F1C are mirrors of $3F00/$3F04/$3F08/$3F0C
            if ((address==0x3f10)||(address==0x3f14)||(address==0x3f18)||(address==0x3f1C))
            {
                retval=this.palette[address-0x3f10];
            }
        }
        else
        {
            console.log("Unhandled PPU read from ["+address+"]");
        }

        var incr=(this.ppuctrl&0x4)>>2;

        if (incr==0) 
        {
            this.ppuAddressAdder+=1;
        }
        else if (incr==1) 
        {
            this.ppuAddressAdder+=32;
        }

        return retval;
    }

    writeControl0x2000(value)
    {
        this.ppuctrl=value;    
        this.ppuLeastSignBits=value&0x1f;
    }

    writeControl0x2001(value)
    {
        this.ppumask=value;    
        this.ppuLeastSignBits=value&0x1f;
    }

    writeOAMaddr0x2003(value)
    {
        this.ppuoamaddr=value;
    }

    writeOAMdata0x2004(value)
    {
        this.sprram[this.ppuoamaddr]=value;
        this.ppuoamaddr++;
        this.ppuoamaddr%=0x100;
    }

    writeOAMDMA0x4014(value,theMmu)
    {
        // DMA transfer start
        // Writing $XX will upload 256 bytes of data from CPU page $XX00-$XXFF to the internal PPU OAM.

        var startAddress=value<<8;
        for (var b=0;b<256;b++)
        {
            //console.log("DMA sprite write reading from "+(startAddress+b).toString(16));
            this.sprram[(this.ppuoamaddr+b)%0x100]=theMmu.readAddr(startAddress+b);
        }

        theMmu.cpu.totCycles+=512; // TODO fixx 513 or 514
    }

    writeScroll0x2005(value)
    {
        //console.log("Write to PPUSCROLL of "+value.toString(16));
        this.ppuscroll=value;    

        if (this.ppuAddressLatch==0) 
        {
            this.scrollx=value;
            this.ppuAddressLatch=1;
        }
        else
        {
            this.scrolly=value;
            this.ppuAddressLatch=0;
        }

        this.ppuLeastSignBits=value&0x1f;
    }

    writeAddress0x2006(value)
    {
        this.ppuaddress=value;    

        if (this.ppuAddressLatch==0)
        {
            this.ppuAddressHighByte=value;
            this.ppuAddressLatch+=1;
        }
        else
        {
            this.ppuAddressLowByte=value;
            this.ppuAddressLatch=0;
        }

        this.ppuAddressAdder=0;
        this.ppuLeastSignBits=value&0x1f;
    }

    writeData0x2007(value)
    {
        var address=this.ppuAddressLowByte|(this.ppuAddressHighByte<<8);
        address+=this.ppuAddressAdder;

        // TODO if ((address>=0)&&(address<=3fff))
        //this.ppudataReadBuffer=value;
        //this.ppudata=this.ppudataReadBuffer; 
        this.ppudata=value;

        if ((address>=0)&&(address<=0x1fff))
        {
            this.vromArray[address]=value;
        }
        else if ((address>=0x2000)&&(address<0x3f00))
        {
            var realAddress=address-0x2000;
            realAddress%=0x1000;
            
            this.nameTable[realAddress]=value;
        }
        else if ((address>=0x3f00)&&(address<=0x3fff))
        {
            // Addresses $3F10/$3F14/$3F18/$3F1C are mirrors of $3F00/$3F04/$3F08/$3F0C

            var realAddress=address-0x3f00;
            realAddress%=0x20;

            this.palette[realAddress]=value;

            if ((address==0x3f10)||(address==0x3f14)||(address==0x3f18)||(address==0x3f1C))
            {
                this.palette[address-0x3f10]=value;
            }
        }
        else
        {
            console.log("Unhandled write to PPU ["+address.toString(16)+"]");
        }

        // 0x2000 bit 2:
        // VRAM address increment per CPU read/write of PPUDATA
        // (0: add 1, going across; 1: add 32, going down)

        var incr=(this.ppuctrl&0x4)>>2;

        if (incr==0) 
        {
            this.ppuAddressAdder+=1;
        }
        else if (incr==1) 
        {
            this.ppuAddressAdder+=32;
        }

        this.ppuLeastSignBits=value&0x1f;
    }
}
