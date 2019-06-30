/* main.js - AlmostNES 2019 */

var globalRomLoader;
var globalListOfOpcodes;
var globalEmuStatus=0; // 0 debugging single step, 1 running
var globalFrameNum=0;
var globalOldCyc=0;
var globalSchedulePeriod=80;

var filterStrength = 20;
var frameTime = 0, lastLoop = new Date, thisLoop;
var fpsArray=new Array();

//
//
//

function romLoadedCallback(rmLdr)
{
	var apu=new nesAPU();
	var ppu=new nesPPU(globalRomLoader.vromArray,rmLdr);
	var mmu=new nesMmu(globalRomLoader.romArray,ppu,apu);
	var cpu=new cpu6502(mmu);
	ppu.setCPU(cpu);
	mmu.setCPU(cpu);
	//cpu.loadGoldenLog("nestestlog/nestest.log");

	/*
	mmu.romptr[0xc00c-0x8000]=0xEA;
	mmu.romptr[0xc00d-0x8000]=0xEA;
	mmu.romptr[0xc011-0x8000]=0xEA;
	mmu.romptr[0xc012-0x8000]=0xEA;
	*/

	//mmu.romptr[0xffa3-0x8000]=0xEA;
	//mmu.romptr[0xffa4-0x8000]=0xEA;

	document.getElementById("mainCanvass").addEventListener("mousemove",function(e)
	{
		var relativeX = e.clientX - document.getElementById("mainCanvass").offsetLeft;
		var relativeY = e.clientY - document.getElementById("mainCanvass").offsetTop;

		cpu.setMousePos(relativeX,relativeY);
	}, 
	false);

	document.onkeydown = function(e)
	{
		if (e.key=="s")
		{
			// single debugger step
			cpu.executeOneOpcode();			
			ppu.step(cpu.totCycles,cpu,610,270,false);
			apu.step(cpu.totCycles);
		}
		else if (e.key=="d")
		{
			// step n debugger steps
			for (var i=0;i<300;i++)
			{
				cpu.executeOneOpcode();			
			}

			ppu.step(cpu.totCycles,cpu,610,270,false);
			apu.step(cpu.totCycles);
		}
		else if (e.key=="a")
		{
			// run to cursor
			var targetPC=cpu.runToCursor(30,globalListOfOpcodes);
			if (targetPC!=-1)
			{
				var times=0;
				var updateTimer=0;
				while ((cpu.pc!=targetPC))
				{
					cpu.executeOneOpcode();
					times+=1;
					updateTimer+=1;

					if (times==3)
					{
						times=0;
						ppu.step(cpu.totCycles,cpu);
						apu.step(cpu.totCycles);
						if ((updateTimer%10000)==0) ppu.simpleRenderer("mainCanvass",610,270)
					}
				}				
			}
		}
		else if (e.key=="z")
		{
			// run to a routine
			//var targetPC=0x8174;
			var targetPC=0xde20;
			var times=0;
			var updateTimer=0;
			while (cpu.pc!=targetPC)
			{
				cpu.executeOneOpcode();
				times+=1;
				updateTimer+=1;

				if (times==3)
				{
					times=0;
					ppu.step(cpu.totCycles,cpu);
					apu.step(cpu.totCycles);
					if ((updateTimer%10000)==0) ppu.simpleRenderer("mainCanvass",610,270)
				}
			}
		}
		else if (e.key=="f")
		{
			// run
			globalEmuStatus=1;
			document.getElementById("mainCanvass").width=256*2;
			document.getElementById("mainCanvass").height=240*2;
		}
		else if (e.key=="g")
		{
			// stop
			globalEmuStatus=0;
			document.getElementById("mainCanvass").width=900;
			document.getElementById("mainCanvass").height=600;

			var media=0.0;
			for (var f=0;f<fpsArray.length;f++)
			{
				media+=parseFloat(fpsArray[f]);
			}
			media/=f;
			//alert(media);
		}
		else if ((e.key=="ArrowDown")||(e.key=="ArrowUp")||(e.key=="ArrowLeft")||(e.key=="ArrowRight")||(e.key=="p")||(e.key=="o")||(e.key=="k")||(e.key=="l"))
		{
			mmu.keyDown(e.key);
			//if (e.key=="ArrowDown") globalEmuStatus=0;
		}
	};

	document.onkeyup = function(e)
	{
		if ((e.key=="ArrowDown")||(e.key=="ArrowUp")||(e.key=="ArrowLeft")||(e.key=="ArrowRight")||(e.key=="p")||(e.key=="o")||(e.key=="k")||(e.key=="l"))
		{
			mmu.keyUp(e.key);
		}
	}
	
	cpu.powerUp();

	function updateScreen()
	{
		if (globalEmuStatus==0)
		{
			globalListOfOpcodes=new Array();
			cpu.debugOpcodes(24,globalListOfOpcodes);
			
			cpu.drawDebugInfo(globalListOfOpcodes,10,30,0);
			ppu.drawDebugInfo("mainCanvass",610,170)

			ppu.simpleRenderer("mainCanvass",610,270,false)
		}
		else if (globalEmuStatus==1)
		{
			while ((cpu.totCycles-globalOldCyc)<(29780))
			{
				cpu.executeOneOpcode();
				ppu.step(cpu.totCycles,cpu,10,10,true);
				apu.step(cpu.totCycles);
			}			

			globalOldCyc=cpu.totCycles;

			//ppu.drawDebugInfo("mainCanvass",610,170)

			globalFrameNum+=1;
		}

		//if ((cpu.pc>=0x1c0)&&(cpu.pc<=0x1d6)) globalEmuStatus=0;

		// calc fps
		var thisFrameTime = (thisLoop=new Date) - lastLoop;
		frameTime+= (thisFrameTime - frameTime) / filterStrength;
		lastLoop = thisLoop;

		window.setTimeout(updateScreen, 1000 / globalSchedulePeriod);
	}

	var fpsOut = document.getElementById('fpsSpan');
	setInterval(function()
	{
		var targetFPS=60;

		var fpeez;
		if (frameTime==0) fpeez=0;
		else fpeez=(1000/frameTime).toFixed(1);
		fpsOut.innerHTML = fpeez + " fps";

		if (fpeez<targetFPS)
		{
			globalSchedulePeriod+=1;
		}
		else if (fpeez>targetFPS)
		{
			globalSchedulePeriod-=1;
		}
	}
	,1000);

	updateScreen();
}

function runNesU()
{
	// games
	//globalRomLoader=new romLoader("roms/smb.nes",romLoadedCallback); // mostly works
	//globalRomLoader=new romLoader("roms/Elevator Action (U).nes",romLoadedCallback); // vertical scrolling problems
	//globalRomLoader=new romLoader("roms/Exed Exes (J) [p1].nes",romLoadedCallback); // vertical scrolling problems
	//globalRomLoader=new romLoader("roms/mariobros.nes",romLoadedCallback); // mostly works
	//globalRomLoader=new romLoader("roms/donkeyKong.nes",romLoadedCallback); // mostly works
	//globalRomLoader=new romLoader("roms/Devil World (Europe).nes",romLoadedCallback); // 
	//globalRomLoader=new romLoader("roms/Antarctic Adventure (J).nes",romLoadedCallback); // stuck
	//globalRomLoader=new romLoader("roms/Chack'n Pop (Japan).nes",romLoadedCallback); // no bg graphics, maybe due to y scrolling
	//globalRomLoader=new romLoader("roms/Door Door (J) [p1].nes",romLoadedCallback); // "0" bg graphics, maybe due to y scrolling
	//globalRomLoader=new romLoader("roms/pacman.nes",romLoadedCallback); // mostly works
	//globalRomLoader=new romLoader("roms/Donkey Kong Jr. (USA) (GameCube Edition).nes",romLoadedCallback); // mostly works, but better check again
	//globalRomLoader=new romLoader("roms/Popeye.nes",romLoadedCallback); // mostly works, have to implement vertical mirroring
	//globalRomLoader=new romLoader("roms/Balloon_fight.nes",romLoadedCallback); // mostly works
	//globalRomLoader=new romLoader("roms/Excitebike (Japan, USA).nes",romLoadedCallback); // problems with raster or scrolling
	//globalRomLoader=new romLoader("roms/galaxian.nes",romLoadedCallback); // scrolling(?) problems
	//globalRomLoader=new romLoader("roms/Mappy (J) [p1].nes",romLoadedCallback); // scrolling problems
	//globalRomLoader=new romLoader("roms/digdug1.nes",romLoadedCallback); // garbage onscreen, probably due to uninplemented mirroring
	//globalRomLoader=new romLoader("roms/Duck_hunt.nes",romLoadedCallback); // mostly works
	//globalRomLoader=new romLoader("roms/year.nes",romLoadedCallback); // mostly works
	//globalRomLoader=new romLoader("roms/tetris.nes",romLoadedCallback); // implement bank switching of nrom1 mapper

	//globalRomLoader=new romLoader("roms/bomberman.nes",romLoadedCallback); // stuck loading screen
	//globalRomLoader=new romLoader("roms/Burger Time (U) [!].nes",romLoadedCallback); // stuck on blank screen
	//globalRomLoader=new romLoader("roms/Mega Man (U).nes",romLoadedCallback); // mapper type 15

	// tests
	//globalRomLoader=new romLoader("roms/blargg_ppu_tests/blargg_ppu_tests_2005.09.15b/sprite_ram.nes",romLoadedCallback); // passes
	//globalRomLoader=new romLoader("roms/blargg_ppu_tests/blargg_ppu_tests_2005.09.15b/vbl_clear_time.nes",romLoadedCallback); // fails $03
	//globalRomLoader=new romLoader("roms/blargg_ppu_tests/blargg_ppu_tests_2005.09.15b/vram_access.nes",romLoadedCallback); // passes
	//globalRomLoader=new romLoader("roms/blargg_ppu_tests/blargg_ppu_tests_2005.09.15b/palette_ram.nes",romLoadedCallback); // passes
	//globalRomLoader=new romLoader("roms/coredump-v1.2.nes",romLoadedCallback); // doesn't work (all zeroes onscreen)
	//globalRomLoader=new romLoader("roms/nes_instr_misc/instr_misc/instr_misc.nes",romLoadedCallback); // 
	//globalRomLoader=new romLoader("roms/cpu_timing_test.nes",romLoadedCallback); // unknown instr. 2
	//globalRomLoader=new romLoader("roms/instr_timing.nes",romLoadedCallback); // mapper type 1
	//globalRomLoader=new romLoader("roms/official.nes",romLoadedCallback);
	//globalRomLoader=new romLoader("roms/color_test.nes",romLoadedCallback);
	//globalRomLoader=new romLoader("roms/full_palette.nes",romLoadedCallback);
	//globalRomLoader=new romLoader("roms/official_only.nes",romLoadedCallback); // passes
	//globalRomLoader=new romLoader("roms/1.Branch_Basics.nes",romLoadedCallback); // passes
	//globalRomLoader=new romLoader("roms/2.Backward_Branch.nes",romLoadedCallback); // passes
	//globalRomLoader=new romLoader("roms/3.Forward_Branch.nes",romLoadedCallback);
	//globalRomLoader=new romLoader("roms/nestest.nes",romLoadedCallback);
	//globalRomLoader=new romLoader("roms/apu_test/apu_test.nes",romLoadedCallback);
	//globalRomLoader=new romLoader("roms/robinerd - real chiptune teaser.nes",romLoadedCallback);
	//globalRomLoader=new romLoader("roms/scroll.nes",romLoadedCallback); // MMC1
}

function handleFileUpload(fls)
{
	globalRomLoader=new romLoader("roms/scroll.nes",romLoadedCallback,fls[0]); 	
}

window.onload=function()
{
	runNesU();
}
