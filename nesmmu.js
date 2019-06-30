/* mmu - friol 2k19 */

class nesMmu
{
    constructor(romarr,theppu,theapu)
    {
        this.romptr=romarr;
        this.ppu=theppu;
        this.apu=theapu;
        this.stack=new Array(0x100);
        this.zeropage=new Array(0x100);
        this.nesram=new Array(0x600);

        for (var b=0;b<0x100;b++)
        {
            this.stack[b]=0;
            this.zeropage[b]=0;
        }

        for (var b=0;b<0x600;b++)
        {
            this.nesram[b]=0;
        }

        // joysticks
        this.regJoy1=0;
        this.joy1bits=0;
        this.joyReadBit=0;

        this.upPressedCtrl1=false;
        this.downPressedCtrl1=false;
        this.rightPressedCtrl1=false;
        this.leftPressedCtrl1=false;
        this.aPressedCtrl1=false;
        this.bPressedCtrl1=false;
        this.selectPressedCtrl1=false;
        this.startPressedCtrl1=false;
    }

    setCPU(thecpu)
    {
        this.cpu=thecpu;
    }

    keyDown(k)
    {
        if (k=="ArrowDown")
        {
            this.downPressedCtrl1=true;
        }
        else if (k=="ArrowUp")
        {
            this.upPressedCtrl1=true;
        }
        else if (k=="ArrowLeft")
        {
            this.leftPressedCtrl1=true;
        }
        else if (k=="ArrowRight")
        {
            this.rightPressedCtrl1=true;
        }
        else if (k=="o")
        {
            this.aPressedCtrl1=true;
        }
        else if (k=="p")
        {
            this.bPressedCtrl1=true;
        }
        else if (k=="l")
        {
            this.selectPressedCtrl1=true;
        }
        else if (k=="k")
        {
            this.startPressedCtrl1=true;
        }
    }

    keyUp(k)
    {
        if (k=="ArrowDown")
        {
            this.downPressedCtrl1=false;
        }
        else if (k=="ArrowUp")
        {
            this.upPressedCtrl1=false;
        }
        else if (k=="ArrowLeft")
        {
            this.leftPressedCtrl1=false;
        }
        else if (k=="ArrowRight")
        {
            this.rightPressedCtrl1=false;
        }
        else if (k=="o")
        {
            this.aPressedCtrl1=false;
        }
        else if (k=="p")
        {
            this.bPressedCtrl1=false;
        }
        else if (k=="l")
        {
            this.selectPressedCtrl1=false;
        }
        else if (k=="k")
        {
            this.startPressedCtrl1=false;
        }
    }

    readAddr(addr)
    {
        if ((addr>=0)&&(addr<0x2000))
        {
            addr%=0x800;

            if (addr<=0xff)
            {
                // zeropage
                return this.zeropage[addr];
            }
            else if ((addr>=0x100)&&(addr<=0x1ff))
            {
                // stack
                return this.stack[addr-0x100];            
            }
            else if ((addr>=0x200)&&(addr<=0x7ff))
            {
                // RAM
                return this.nesram[addr-0x200];
            }
        }
        else if ((addr>=0x2000)&&(addr<=0x3fff))
        {
            var realAddr=0x2000+(addr%8);
            if (realAddr==0x2002)
            {
                // PPU status
                return this.ppu.getPPUstatusRegister();
            }
            else if (realAddr==0x2003)
            {
                // read OAMaddr
                console.log("Warning: program tries to read from 0x2003");
            }
            else if (realAddr==0x2004)
            {
                // read OAMdata
                console.log("Read from 0x2004");
                return this.ppu.getPPUdata0x2004();
            }
            else if (realAddr==0x2007)
            {
                // TODO PPU register read
                return this.ppu.getPPUDATA0x2007();
            }
        }
        else if (addr==0x4015)
        {
            return this.apu.getAPUStatus0x4015();
        }
        else if (addr==0x4016)
        {
            // joystick 1

            this.joy1bits=0;
            if (this.upPressedCtrl1)
            {
                this.joy1bits|=0x10;
            }
            if (this.downPressedCtrl1)
            {
                this.joy1bits|=0x20;
            }
            if (this.leftPressedCtrl1)
            {
                this.joy1bits|=0x40;
            }
            if (this.rightPressedCtrl1)
            {
                this.joy1bits|=0x80;
            }
            if (this.aPressedCtrl1)
            {
                this.joy1bits|=0x01;
            }
            if (this.bPressedCtrl1)
            {
                this.joy1bits|=0x02;
            }
            if (this.selectPressedCtrl1)
            {
                this.joy1bits|=0x04;
            }
            if (this.startPressedCtrl1)
            {
                this.joy1bits|=0x08;
            }

            var readValue=(this.joy1bits>>(this.joyReadBit))&0x01;

            this.joy1bits&=~(1<<this.joyReadBit);

            this.joyReadBit+=1;
            if (this.joyReadBit>7)
            {
                this.joyReadBit=0;
            }

            //console.log("Read from joystick1 ["+readValue+"]");
            return readValue;
        }
        else if (addr==0x4017)
        {
            // read controller 2
            // todo
            
            return 0x0;
        }
        else if ((addr>=0x8000)&&(addr<=0xffff))
        {
            return this.romptr[addr-0x8000];    
        }
        else
        {
            alert("Unmapped read from ["+addr.toString(16)+"] at address ["+addr.toString(16)+"]");
        }

        return 0;
    }

    readAddr16bit(addr)
    {
        if (addr<=0xff) return (this.readAddr(addr)+(this.readAddr((addr+1)&0xff)<<8));
        return (this.readAddr(addr)+(this.readAddr(addr+1)<<8));
    }

    writeAddr(addr,value)
    {
        if (addr<=0xff)
        {
            // zeropage
            this.zeropage[addr]=value;
        }
        else if ((addr>=0x100)&&(addr<=0x1ff))
        {
            // stack
            this.stack[addr-0x100]=value;            
        }
        else if ((addr>=0x200)&&(addr<=0x7ff))
        {
            // RAM
            this.nesram[addr-0x200]=value;
        }
        else if ((addr>=0x2000)&&(addr<=0x3fff))
        {
            var realAddr=0x2000+(addr%8);
            if (realAddr==0x2000)
            {
                // PPU control register 0x2000
                this.ppu.writeControl0x2000(value);
                //console.log("Write to PPU control register 0x2000 ["+value.toString(16)+"]");
            }
            else if (realAddr==0x2001)
            {
                // PPU mask register 0x2001
                this.ppu.writeControl0x2001(value);
            }
            else if (realAddr==0x2003)
            {
                // PPU OAMADDR
                this.ppu.writeOAMaddr0x2003(value);
                //console.log("Write to PPU address register 0x2003 OAM ADDR ["+value.toString(16)+"]");
            }
            else if (realAddr==0x2004)
            {
                //console.log("Write to PPU OAM data register 0x2004 ["+value.toString(16)+"]");
                this.ppu.writeOAMdata0x2004(value);
            }
            else if (realAddr==0x2005)
            {
                // PPU scroll register 0x2005
                this.ppu.writeScroll0x2005(value);
            }
            else if (realAddr==0x2006)
            {
                // PPU address register 0x2006
                this.ppu.writeAddress0x2006(value);
                //console.log("Write to PPU address register 0x2006 ["+value.toString(16)+"]");
            }
            else if (realAddr==0x2007)
            {
                // PPU data register 0x2007
                this.ppu.writeData0x2007(value);
                //console.log("Write to PPU data register 0x2007 ["+value.toString(16)+"]");
            }
            else
            {
                console.log("Unmapped MMU write to "+realAddr.toString(16));
            }
        }
        else if ((addr>=0x4000)&&(addr<=0x4003))
        {
            // APU Pulse1
            this.apu.writePulse(value,addr,0);
        }
        else if ((addr>=0x4004)&&(addr<=0x4007))
        {
            // APU Pulse2
            this.apu.writePulse(value,addr,1);
        }
        else if ((addr>=0x4008)&&(addr<=0x400B))
        {
            // APU Triangle
            this.apu.writeTriangle(value,addr);
        }
        else if (addr==0x4014)
        {
            // PPU OAM DMA
            this.ppu.writeOAMDMA0x4014(value,this);            
            //console.log("Write to PPU OAM DMA register 0x4014 ["+value.toString(16)+"]");
        }
        else if (addr==0x4015)
        {
            // APU status register
            this.apu.writeStatusRegister0x4015(value);
        }
        else if (addr==0x4016)
        {
            // joystick 1
            this.regJoy1=value;
            //console.log("Write to joystick 1 ["+value.toString(16)+"]");
        }
        else if (addr==0x4017)
        {
            // APU frame counter
            this.apu.writeFrameCounter0x4017(value);
        }
        else
        {
            console.log("Unmapped write to ["+addr.toString(16)+"] at address ["+addr.toString(16)+"]");
        }
    }

    writeAddr16bit(addr,value)
    {
        console.log("Warning: unhandled write 16 bit to MMU");    
    }
}
