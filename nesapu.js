/* NES APU - 2k19 */

class nesAPU
{
    constructor()
    {
        this.frameCounter=0;
        this.statusRegister=0;

        // eventsQueue

        this.eventsQueue=new Array();
        this.internalClock=0;
        this.internalClockPos=0;

        // channels

        this.pulseArray=new Array(2);
        
        this.pulseArray[0]=new Object();
        this.pulseArray[1]=new Object();
        
        this.pulseArray[0].enabled=false;
        this.pulseArray[1].enabled=false;
        this.pulseArray[0].period=0;
        this.pulseArray[1].period=0;
        this.pulseArray[0].volume=0;
        this.pulseArray[1].volume=0;
        
        this.pulseArray[0].lengthCounter=10;
        this.pulseArray[1].lengthCounter=10;
        this.pulseArray[0].lengthPos=0;
        this.pulseArray[1].lengthPos=0;
        this.pulseArray[0].lengthCounterHaltFlag=0;
        this.pulseArray[1].lengthCounterHaltFlag=0;
        
        this.pulseArray[0].wavePos=0;
        this.pulseArray[1].wavePos=0;
        this.pulseArray[0].periodPos=0;
        this.pulseArray[1].periodPos=0;
        this.pulseArray[0].dutyCycle=0;
        this.pulseArray[1].dutyCycle=0;
        this.pulseArray[0].volume=0;
        this.pulseArray[1].volume=0;
        this.pulseArray[0].useConstantVolume=false;
        this.pulseArray[1].useConstantVolume=false;
        this.pulseArray[0].volumeEnvelopePos=0;
        this.pulseArray[1].volumeEnvelopePos=0;
        
        this.pulseArray[0].sweepEnabled=false;
        this.pulseArray[1].sweepEnabled=false;
        this.pulseArray[0].targetPeriod=0;
        this.pulseArray[1].targetPeriod=0;
        this.pulseArray[0].negateFlag=false;
        this.pulseArray[1].negateFlag=false;
        this.pulseArray[0].sweepIncrement=0;
        this.pulseArray[1].sweepIncrement=0;

        this.triangleChannel=new Object();
        this.triangleChannel.enabled=false;
        this.triangleChannel.period=0;
        this.triangleChannel.periodPos=0;
        this.triangleChannel.wavePos=0;
        this.triangleChannel.linearCounter=0;

        this.triangleChannelArray=[15, 14, 13, 12, 11, 10,  9,  8,  7,  6,  5,  4,  3,  2,  1,  0, 0,  1,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11, 12, 13, 14, 15];

        this.dutyCycleArray=[
            [0,1,0,0,0,0,0,0],
            [0,1,1,0,0,0,0,0],
            [0,1,1,1,1,0,0,0],
            [1,0,0,1,1,1,1,1]
        ];

        // sound engine

        try 
        {
            //this.audioEnabled=false;
            this.audioEnabled=true;
            this.audioBufSize=1024;

            var self=this;
            this.webAudioAPIsupported=true;
    
            window.AudioContext = window.AudioContext||window.webkitAudioContext;
            this.context = new AudioContext();
    
            this.gainNode = this.context.createGain();
            this.gainNode.gain.value = 0.5;
    
            this.jsNode = this.context.createScriptProcessor(this.audioBufSize, 0, 2);
            this.jsNode.onaudioprocess = function(e)
            {
                self.mixFunction(e);
            }
    
            this.jsNode.connect(this.gainNode);
    
            this.gainNode.connect(this.context.destination);

            // frame counter
            this.frameCounterFrequency=this.audioBufSize/(240.0/(this.context.sampleRate/this.audioBufSize));
            this.frameCounterPos=0;
        }
        catch(e) 
        {
            alert('Error: Web Audio API is not supported in this browser. Buy a new one.');
            this.webAudioAPIsupported=false;
        }        
    }

    mixFunction(e)
    {
        if (!this.audioEnabled) return;

        const fullSound=0.5;
        var dataL = e.outputBuffer.getChannelData(0);
        var dataR = e.outputBuffer.getChannelData(1);

        const multiplier=48;
        var sampleArray=new Array(multiplier);

        for (var s=0;s<this.audioBufSize;s++)
        {
            var curBuf=0;

            for (var cyc=0;cyc<multiplier;cyc++)
            {
                // process queued events if current time >= event timestamp

                if ((this.eventsQueue.length>0)&&(this.eventsQueue[0][3]<=this.internalClockPos))
                {
                    var curEvent=this.eventsQueue.shift();
                    var value=curEvent[2];

                    if ((curEvent[0]=="w")&&(curEvent[1]==0x4000))
                    {
                        this.pulseArray[0].dutyCycle=(value>>6)&0x03;
                        this.pulseArray[0].volume=value&0x0f;
                        this.pulseArray[0].useConstantVolume=(value&0x10)?true:false;
                        if (!this.pulseArray[0].useConstantVolume)
                        {
                            // volume envelope
                            this.pulseArray[0].volumeEnvelopePos=value&0x0f;
                        }
                        if (value&0x20) this.pulseArray[0].lengthCounterHaltFlag=1;
                        else this.pulseArray[0].lengthCounterHaltFlag=0;
                    }
                    else if ((curEvent[0]=="w")&&(curEvent[1]==0x4001))
                    {
                        // $4001 / $4005	EPPP NSSS	Sweep unit: enabled (E), period (P), negate (N), shift (S)
                        if (value&0x80)
                        {
                            this.pulseArray[0].sweepEnabled=true;
                            this.pulseArray[0].negateFlag=(value&0x08)?true:false;
                            if (this.pulseArray[0].negateFlag)
                            {
                                this.pulseArray[0].targetPeriod=this.pulseArray[0].period-(this.pulseArray[0].period>>(value&0x07));
                                this.pulseArray[0].targetPeriod*=2.56;
                            }
                            else
                            {
                                this.pulseArray[0].targetPeriod=this.pulseArray[0].period+(this.pulseArray[0].period>>(value&0x07));
                                this.pulseArray[0].targetPeriod*=2.56;
                            }
                        }
                        else
                        {
                            this.pulseArray[0].sweepEnabled=false;
                        }
                    }
                    else if ((curEvent[0]=="w")&&(curEvent[1]==0x4002))
                    {
                        this.pulseArray[0].period=((this.pulseArray[0].period&0x0700)|value)+1;
                        this.setPulsePeriod(0);
                    }
                    else if ((curEvent[0]=="w")&&(curEvent[1]==0x4003))
                    {
                        this.pulseArray[0].period=(((value&0x07)<<8)|(this.pulseArray[0].period&0xff))+1;
                        this.setPulsePeriod(0);
                        this.pulseArray[0].wavePos=0;
                        this.setLengthCounter(0,(value&0xf8)>>3);
                    }
                    else if ((curEvent[0]=="w")&&(curEvent[1]==0x4004))
                    {
                        this.pulseArray[1].dutyCycle=(value>>6)&0x03;
                        this.pulseArray[1].volume=value&0x0f;
                        this.pulseArray[1].useConstantVolume=(value&0x10)?true:false;
                        if (!this.pulseArray[1].useConstantVolume)
                        {
                            // volume envelope
                            this.pulseArray[1].volumeEnvelopePos=value&0x0f;
                        }
                        if (value&0x20) this.pulseArray[1].lengthCounterHaltFlag=1;
                        else this.pulseArray[1].lengthCounterHaltFlag=0;
                    }
                    else if ((curEvent[0]=="w")&&(curEvent[1]==0x4005))
                    {
                        // $4005	EPPP NSSS	Sweep unit: enabled (E), period (P), negate (N), shift (S)
                        if (value&0x80)
                        {
                            this.pulseArray[1].sweepEnabled=true;
                            this.pulseArray[1].negateFlag=(value&0x08)?true:false;
                            if (this.pulseArray[1].negateFlag)
                            {
                                this.pulseArray[1].targetPeriod=this.pulseArray[1].period-(this.pulseArray[1].period>>(value&0x07));
                            }
                            else
                            {
                                this.pulseArray[1].targetPeriod=this.pulseArray[1].period+(this.pulseArray[1].period>>(value&0x07));
                            }
                        }
                        else
                        {
                            this.pulseArray[1].sweepEnabled=false;
                        }
                    }
                    else if ((curEvent[0]=="w")&&(curEvent[1]==0x4006))
                    {
                        this.pulseArray[1].period=((this.pulseArray[1].period&0x0700)|value)+1;
                        this.setPulsePeriod(1);
                    }
                    else if ((curEvent[0]=="w")&&(curEvent[1]==0x4007))
                    {
                        this.pulseArray[1].period=(((value&0x07)<<8)|(this.pulseArray[1].period&0xff))+1;
                        this.setPulsePeriod(1);
                        this.pulseArray[1].wavePos=0;
                        this.setLengthCounter(1,(value&0xf8)>>3);
                    }
                    else if ((curEvent[0]=="w")&&(curEvent[1]==0x4008))
                    {
                        this.triangleChannel.linearCounter=value&0x7f;
                    }
                    else if ((curEvent[0]=="w")&&(curEvent[1]==0x400A))
                    {
                        this.triangleChannel.period=((this.triangleChannel.period&0x0700)|value)+1;
                        this.triangleChannel.periodPos=0;
                        this.triangleChannel.wavePos=0;

                        if (this.triangleChannel.period<=1)
                        {
                            this.triangleChannel.enabled=false;
                        }
                    }
                    else if ((curEvent[0]=="w")&&(curEvent[1]==0x400B))
                    {
                        this.triangleChannel.period=(((value&0x07)<<8)|(this.triangleChannel.period&0xff))+1;
                        this.triangleChannel.wavePos=0;

                        if (this.triangleChannel.period<=1)
                        {
                            this.triangleChannel.enabled=false;
                        }

                        if (((value>>3)&0x1f)>this.triangleChannel.linearCounter)
                        {
                            this.triangleChannel.linearCounter=(value>>3)&0x1f;
                        }
                    }
                    else if ((curEvent[0]=="w")&&(curEvent[1]==0x4015))
                    {
                        this.statusRegister=value;
            
                        if (value&0x01) this.pulseArray[0].enabled=true;
                        else this.pulseArray[0].enabled=false;
                
                        if (value&0x02) this.pulseArray[1].enabled=true;
                        else this.pulseArray[1].enabled=false;
                
                        if (value&0x04) this.triangleChannel.enabled=true;
                        else this.triangleChannel.enabled=false;
                    }
        
                }

                //
                // MIX
                //

                if (globalEmuStatus==1)
                {
                    // 2 pulse channels

                    for (var pulse=0;pulse<2;pulse++)
                    {
                        if (this.pulseArray[pulse].enabled)
                        {
                            var volume=0;
                            if (this.pulseArray[pulse].useConstantVolume) 
                            {
                                volume=this.pulseArray[pulse].volume/15.0;
                            }
                            else 
                            {
                                volume=this.pulseArray[pulse].volumeEnvelopePos/15.0;
                            }

                            curBuf+=fullSound*this.dutyCycleArray[this.pulseArray[pulse].dutyCycle][this.pulseArray[pulse].wavePos]*volume;

                            this.pulseArray[pulse].periodPos+=1;
                            if (this.pulseArray[pulse].periodPos>=(this.pulseArray[pulse].period*2.56))
                            {
                                this.pulseArray[pulse].wavePos=(this.pulseArray[pulse].wavePos+1)%8;    
                                this.pulseArray[pulse].periodPos=0;
                            }
                        }
                    }

                    // update frame counter
                    this.frameCounterPos+=1;
                    if (this.frameCounterPos==(this.frameCounterFrequency*multiplier*16))
                    {
                        this.frameCounterPos=0;

                        // update pulse envelopes
                        for (var pulse=0;pulse<2;pulse++)
                        {
                            if (this.pulseArray[pulse].volumeEnvelopePos>0)
                            {
                                this.pulseArray[pulse].volumeEnvelopePos--;
                            }
                        }

                        // update sweep if set

                        if (this.pulseArray[0].sweepEnabled)
                        {
                            if (this.pulseArray[0].negateFlag==false)
                            {
                                if (this.pulseArray[0].period<this.pulseArray[0].targetPeriod)
                                {
                                    this.pulseArray[0].period+=1;
                                }
                            }                            
                            else
                            {
                                if (this.pulseArray[0].period>this.pulseArray[0].targetPeriod)
                                {
                                    this.pulseArray[0].period-=1;
                                }
                            }
                        }
/*
                        // update triangle
                        if (this.triangleChannel.enabled)
                        {
                            this.triangleChannel.linearCounter-=1;
                            if (this.triangleChannel.linearCounter<=0)
                            {
                                this.triangleChannel.enabled=false;
                            }
                        }
*/                    
                    }

                    // triangle /\ channel

                    if (this.triangleChannel.enabled)
                    {
                        curBuf+=(this.triangleChannelArray[this.triangleChannel.wavePos]/15.0);

                        this.triangleChannel.periodPos+=1;
                        if (this.triangleChannel.periodPos>=(this.triangleChannel.period*1.28))
                        {
                            this.triangleChannel.wavePos=(this.triangleChannel.wavePos+1)%32;    
                            this.triangleChannel.periodPos=0;
                        }
                    }
                }

                curBuf/=4.0;
                sampleArray[cyc]=curBuf;

                //

                this.internalClockPos+=1;
            }

            // average the array, and output it 
            var runningTotal=0;
            for (var i=0;i<multiplier;i++)
            {
                runningTotal+=sampleArray[i];
            }
            runningTotal/=multiplier;

            dataL[s]=runningTotal;
            dataR[s]=runningTotal;
        }
    }

    step(totCpuCycles)
    {
        this.internalClock=totCpuCycles;
    }

    getAPUStatus0x4015()
    {
        console.log("Warning: reading from APU status 0x4015");
        return 0;
    }

    setPulsePeriod(pulseNum)
    {
        if (this.pulseArray[pulseNum].period<8)
        {
            this.pulseArray[pulseNum].enabled=false;
            this.pulseArray[pulseNum].wavePos=0;
            this.pulseArray[pulseNum].periodPos=0;
        }
    }

    setLengthCounter(pulseNum,tableIndex)
    {
        // If the enabled flag is set, the length counter is loaded with entry L of the length table:
        //|  0   1   2   3   4   5   6   7    8   9   A   B   C   D   E   F
        //-----+----------------------------------------------------------------
        //00-0F  10,254, 20,  2, 40,  4, 80,  6, 160,  8, 60, 10, 14, 12, 26, 14,
        //10-1F  12, 16, 24, 18, 48, 20, 96, 22, 192, 24, 72, 26, 16, 28, 32, 30

        var lengthTable=[10,254, 20,  2, 40,  4, 80,  6, 160,  8, 60, 10, 14, 12, 26, 14,12, 16, 24, 18, 48, 20, 96, 22, 192, 24, 72, 26, 16, 28, 32, 30];

        this.pulseArray[pulseNum].lengthCounter=lengthTable[tableIndex];
        this.pulseArray[pulseNum].lengthPos=0;

        console.log("Lenght counter set to "+this.pulseArray[pulseNum].lengthCounter);
    }

    writePulse(value,addr,pulseNum)
    {
        var originalAddr=addr;
        addr=(addr-0x4000)%4;

        if (addr==0)
        {
            // Duty cycle, length counter halt, constant volume/envelope flag, and volume/envelope divider period DDLC VVVV
            console.log("Write to Pulse "+pulseNum+" 0x4000 "+value.toString(16));
            this.eventsQueue.push(["w",originalAddr,value,this.internalClock]);
        }
        else if (addr==1)
        {
            // Sweep unit: enabled (E), period (P), negate (N), shift (S) EPPP NSSS
            console.log("Write to Pulse "+pulseNum+" 0x4001 "+value.toString(16));
            this.eventsQueue.push(["w",originalAddr,value,this.internalClock]);
        }
        else if (addr==2)
        {
            // timer (length) low TTTT TTTT
            console.log("Write to Pulse "+pulseNum+" 0x4002 "+value.toString(16));
            this.eventsQueue.push(["w",originalAddr,value,this.internalClock]);
        }
        else if (addr==3)
        {
            // Length counter load (L), timer high (T) LLLL LTTT
            console.log("Write to Pulse "+pulseNum+" 0x4003 "+value.toString(16));
            this.eventsQueue.push(["w",originalAddr,value,this.internalClock]);
        }
    }

    writeTriangle(value,addr)
    {
        if (addr==0x4008)
        {
            // CRRR RRRR	Length counter halt / linear counter control (C), linear counter load (R)
            console.log("Write to Triangle 0x4008 "+value.toString(16));
            this.eventsQueue.push(["w",addr,value,this.internalClock]);
        }
        else if (addr==0x400A)
        {
            // TTTT TTTT	Timer low (T)
            console.log("Write to Triangle 0x400A "+value.toString(16));
            this.eventsQueue.push(["w",addr,value,this.internalClock]);
        }
        else if (addr==0x400B)
        {
            // LLLL LTTT	Length counter load (L), timer high (T)
            console.log("Write to Triangle 0x400B "+value.toString(16));
            this.eventsQueue.push(["w",addr,value,this.internalClock]);
        }
    }

    writeStatusRegister0x4015(value)
    {
        this.eventsQueue.push(["w",0x4015,value,this.internalClock]);
    }

    writeFrameCounter0x4017(value)
    {
        // frame counter
        this.frameCounter=value;
    }
}
