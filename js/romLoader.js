/* NES rom loader (iNES) */

class romLoader
{
    constructor(fileName,romLoadedCallback,inFile)
    {
        this.romArray=new Array();
        this.vromArray=new Array();

        var thisInstance=this;
/*
        $.ajax({
            url: fileName,
            type: "GET",
            dataType: "binary",
            processData: false,
            success: function(data) 
            {
                var arrayBuffer;
                var fileReader = new FileReader();
                fileReader.onload = function(event) 
                {
                    arrayBuffer = event.target.result;
                    var uint8ArrayNew  = new Uint8Array(arrayBuffer);
                    var retcode=thisInstance.readRom(uint8ArrayNew);
                    if (retcode==0)
                    {
                        romLoadedCallback(thisInstance);
                    }
                    else
                    {
                        alert("An error occurred loading rom");
                    }
                };
                fileReader.readAsArrayBuffer(data);          
            },
            error: function(xhr, status, error)
            {
                alert("error loading .nes rom ["+error+"]");
            }
          });
*/

        var arrayBuffer;
        var fileReader = new FileReader();
        fileReader.onload = function(event) 
        {
            arrayBuffer = event.target.result;
            var uint8ArrayNew  = new Uint8Array(arrayBuffer);
            var retcode=thisInstance.readRom(uint8ArrayNew);
            if (retcode==0)
            {
                romLoadedCallback(thisInstance);
            }
            else
            {
                alert("An error occurred loading rom");
            }
        };
        fileReader.readAsArrayBuffer(inFile);   

    }

    copyROM(src,srcoffset,dest,destoffset,bytes)
    {
        for (var b=0;b<bytes;b++)
        {
            dest[destoffset+b]=src[srcoffset+b];
        }
    }

    readRom(romarr)
    {
        if (String.fromCharCode(romarr[0])!="N")
        {
            console.log("Invalid header of .nes file");
            return 1;
        }
        if (String.fromCharCode(romarr[1])!="E")
        {
            console.log("Invalid header of .nes file");
            return 1;
        }
        if (String.fromCharCode(romarr[2])!="S")
        {
            console.log("Invalid header of .nes file");
            return 1;
        }

        // 4        Number of 16kB ROM banks.
        // 5        Number of 8kB VROM banks.

        var numOf16kROMbanks=romarr[4];
        var numOf8kROMbanks=romarr[5];

        console.log(".nes ROM contains "+numOf16kROMbanks+" 16k ROM bank(s) and "+numOf8kROMbanks+" 8k VROM bank(s)");

        var flags6=romarr[6];
        var flags7=romarr[7];
        var flags9=romarr[9];

        var mapperType=(flags6>>4)|((flags7>>4)<<4);

        console.log("Flags6 is "+flags6.toString(16));

        if (flags6&1)
        {
            console.log("Mirroring is horizontal");
            this.mirroring=1; 
        }
        else
        {
            console.log("Mirroring is vertical");
            this.mirroring=0;
        }

        console.log("Mapper type seems to be ["+mapperType+"]");
        this.mapper=mapperType;

        console.log("ROM type is "+flags9);

        // load based on mapper type

        if (mapperType==0)
        {
            // 0        No mapper             All 32kB ROM + 8kB VROM games

            for (var b=0;b<numOf16kROMbanks;b++)
            {
                this.copyROM(romarr,16+(16384*b),this.romArray,16384*b,16384);
            }

            // if number of 16k rom banks is 1, mirror 16k rom to c000-0xffff
            if (numOf16kROMbanks==1)
            {
                this.copyROM(romarr,16,this.romArray,16384*1,16384);
            } 

            this.copyROM(romarr,16+(16384*numOf16kROMbanks),this.vromArray,0,8192);
        }
        else if (mapperType==1)
        {
            for (var b=0;b<numOf16kROMbanks;b++)
            {
                this.copyROM(romarr,16+(16384*b),this.romArray,16384*b,16384);
            }

            this.copyROM(romarr,16+(16384*numOf16kROMbanks)+8192,this.vromArray,0,8192);
            this.copyROM(romarr,16+(16384*numOf16kROMbanks),this.vromArray,8192,8192);
        }
        else
        {
            console.log("Error: unsupported mapper type ["+mapperType+"]");
            return 1;
        }

        return 0;
    }
}
