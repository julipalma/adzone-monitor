// 10003_parallax-video2
// v 3
// 2026-Aug-11 16:03:44

// update version 1.1

class adzone_extra_parallax_video {
  #t; #p;
  #top_i_margin;
  #bottom_i_margin;

  constructor(t, p) {


  t.callback = function(entries, observer) {
    entries.forEach((entry) => {
      t.is_visible = entry.isIntersecting;
      if(t.is_visible) {
        t.button_play()
      } else {
        t.button_pause()
      }
      return 
      if(entry.isIntersecting && t.play_on_view) {
        // not played yet
        t.play_on_view = false;
        t.is_paused && !t.is_playing && t.button_play();
      } else {
        if(entry.isIntersecting) {
          t.is_paused && ad.button_play();
        } else {
          !t.is_paused && t.is_playing && t.button_pause();
        }
      }
    });
  }

  t.set_observer = function(){
    t.observer = new IntersectionObserver(t.callback, {
      root: null, 
      rootMargin: (adzone.is_mobile?'-150px 0px -150px 0px':'-300px 0px -300px 0px'),
      threshold: 0
    });
    t.observer.observe(t.iframe);
  }    
  t.button_pause = function() {
    // if(!ad.pause_pressed) {
    //   ad.pause_pressed = true;
    //   ad.track("pause");
    // }      
    // ad.is_paused = true;
    // console.log("Pause")
    t.video.pause();
    // ad.change_reload_img("play");
  }
  t.button_play = function() {
    // ad.is_playing = true;
    // ad.is_paused = false;
    // console.log("Play")
    if(!t.has_already_played) {
      t.has_already_played=1;
      t.track("video_play");
    }
    t.video.play().catch(err => console.log(`Caught by .catch ${err}`));
    // ad.change_reload_img("pause");
  };
  
  t.track=function(event) {
  let params=t.params;
  var p2={
    f:params.format_id||"",
    v:params.version||1,
    a:(event||"video_none"),
    h:window.top.document.location.host.replace("www.",""),
    vn:params.video_name||"",
    cn:params.creative_name||""
  }
  var d2 = "";
  for(let i in p2) {
    d2 += (d2==""?"":";")+i+":"+encodeURIComponent(p2[i]);
  }
  let cb2=Date.now()+""+Math.ceil(Math.random()*1000)
  let im2 = new Image();
  im2.src = 'https://e1.jarvanvideo.com/?k='+d2+"&c="+cb2;


    // external pixel
    if(params["url_"+event] && params["url_"+event]!="") {
      let url = params["url_"+event];
      url = ad.check_timestamp(url);
      let url_type = "url";

      if( url.toLowerCase().substring(0,5)=="<img " 
              || url.toLowerCase().substring(0,8)=="<iframe ") {
        url_type = "html";
      } else if(url.substring(0,7)=="http://") {
        url = "https://" + url.substring(7);
      } else if(url.substring(0,8)!="https://") {
        url = "https://" + url;
      }
      
      url = url.replace(/\$\{GDPR\}/g, "0");
      url = url.replace(/\$\{GDPR\_CONSENT\_[0-9]*\}/g, "");

      if(url_type=="url") {
        let im = new Image();
        im.src = url;
      } else {
        let d = document.createElement("div");
        d.style.cssText = "width:1px;height:1px;display:none";
        d.innerHTML = url;
        document.body.appendChild(d);
      }
    }
  }
  t.set_on_ended = function() {
    t.video.onended = function(e) {
      t.track("video_100");
      if(t.params.action_on_video_end && t.params.action_on_video_end=="replay") {
        window.setTimeout(function(){
          t.video.currentTime = 0;
          t.video.play()
        }, 1000);
      }
    };
  }




  	
    this.#t = t;
    this.#p = p;
    this.#top_i_margin = adzone.styles.parallax_top_i_margin || (adzone.is_mobile?50:120);
    this.#bottom_i_margin = adzone.styles.parallax_bottom_i_margin || (adzone.is_mobile?50:90);
    
    this.#run();
  }


  #run() { 
  	let t = this.#t;
    let p = this.#p;

  // if(window.top.adzone_parallax_run){ return }
  //   window.top.adzone_parallax_run = 1;
    t.params = p;
    
    if(!t.height) {
      t.height = 250
    } else {
      t.height = ((t.height+"").replace("px",""))*1;
    }
    if(t.width*1<2) {
      debugger
    }
    
    !t.div && t.divId && (t.div=document.getElementById(t.divId));
    t.iframe = t.div.querySelector("iframe");
    t.params.horizontal_expansion = (t.params.horizontal_expansion==1?true:false);
    t.params.vertical_expansion = (t.params.vertical_expansion==1?true:false);


    t.iframe.style.backgroundColor="transparent";
    t.iframe.style.position="absolute";
    t.iframe.style.zIndex="1";
    t.iframe.style.left="0";
    t.iframe.style.border="0";
    let ifd = t.iframe.contentWindow.document;
    let click_layer=ifd.createElement("div");
    click_layer.innerHTML="<div style='cursor:pointer;position:fixed;top:0;left:0;width:100vw;height:100vh;'></div>";
    click_layer.onclick = function(){ window.open(p.click_url+p.dest_url) };
    ifd.body.appendChild(click_layer);

    t.iframe.setAttribute("allowTransparency", "true")
    
    let div = t.iframe.parentElement;
    if(div&&div.parentElement && div.parentElement.dataset) {
      div.parentElement.dataset.allow_vertical_expansion && (t.allow_vertical_expansion=true);
      div.parentElement.dataset.allow_horizontal_expansion && (t.allow_horizontal_expansion=true);
    }
    t.allow_vertical_expansion=true;
    t.allow_horizontal_expansion=true;

    if(t.allow_vertical_expansion && p.expand_height && p.expand_height>t.height) {
      t.height = (p.expand_height*1)+"px";
    } else if((p.expand_height+"").includes("vh")){
      t.height = p.expand_height;
    } else if(!(t.height+"").includes("vh") && !(t.height+"").includes("px")) {
      t.height = t.height + "px";
    }
    if(!t.allow_horizontal_expansion) {
      t.p_horizontal_expansion=false;
    }


    div.style.position="relative";
    let new_div = document.createElement("div");
    new_div.style.cssText="position:absolute;display:inline-block; left:0;width:"+t.width+"px;height:"+t.height+"px;background-color:transparent"
    new_div.innerHTML = `
<div class="adzone_parallax_1" style="
    clip: rect(auto,auto,auto,auto);
    position: absolute;
    background-color: transparent;
    height: `+t.height+`;
    width: `+t.width+`px;
    border:0;
    text-align:right;
    top: 0;">
    <div class="adzone_parallax2" style="z-index:1;position: fixed; top: 0px; left: 0px; width: 100vw; height: 100vh; border: none; pointer-events: none; background-color: `+(p.background_color||"white")+`;">
    <img>
    <video style='display:none' autoplay muted playsinline></video>
    </div>
    </div>
    `;
    t.iframe.style.width=t.width+"px";
    t.iframe.style.height=t.height;
    t.iframe.style.maxWidth="100%";
    div.style.width=t.width+"px";
    div.style.height=t.height;
    div.style.maxWidth="100%";
    div.appendChild(new_div);
    div.style.backgroundColor="transparent"
    let r = div.getBoundingClientRect();
    let full_width = "calc(100vw - "+this.#getScrollbarWidth()+"px)";
    if(p.horizontal_expansion) {
      div.style.position="";
      div.style.width=full_width;
      div.querySelector(".adzone_parallax_1").style.width=full_width;
      t.iframe.style.width=full_width;
    } else {
      full_width=div.style.width;
    }

    if(p.video_name) {
      t.video = div.querySelector("video");

      let cdn = "https://s1.adzonestatic.com";
      p.publisher_code = p.video_name.split("_")[0];
      t.video.src = cdn +"/stream2/" + p.publisher_code+"/"+p.video_name+"/v0." + p.video_extension;
      t.video.addEventListener('loadedmetadata', () => {
        //const aspectRatio = t.video.videoWidth / t.video.videoHeight;
        //console.log('Aspect Ratio:', aspectRatio);
        t.track("video_print");
        t.video.style.display="inline-block";
        window.video = t.video;

        t.p_div = div;
        t.p_nw = t.video.videoWidth || t.p_nw;
        t.p_nh = t.video.videoHeight || t.p_nh;
        t.p_full_width = full_width;

        t.parallax_center();


        //t.video.play()
        t.set_observer();
        t.set_on_ended();
      });


    } else {
      const img2 = new Image();
      img2.src = "https://s1.adzonestatic.com/" + p.image;

      img2.onload = () => {
        let i = div.querySelector("img");
        i.style.visibility="hidden";
        i.src=img2.src
        let nw = img2.naturalWidth;
        let nh = img2.naturalHeight;
        
        t.p_div = div;
        t.p_nw = nw || t.p_nw;
        t.p_nh = nh || t.p_nh;
        t.p_full_width = full_width;
        t.video = i;
      

		window.addEventListener('resize', () => { this.#parallax_center(); });

        this.#parallax_center();
      };
    }
  }

  #parallax_center() {
  	let t = this.#t;
    let p = this.#p;

    let div = t.p_div;
    div.style.margin="0 auto";
    let i = t.video;
    let is_complete = i.complete||false;
    if(i.readyState && i.readyState>3) {
      is_complete = true;    
    }
    if(!is_complete) {
      t.image_not_loaded = (t.image_not_loaded || 0) + 1;
      if(t.image_not_loaded<100) {
        console.log("img not loaded")
		setTimeout(() => { this.#parallax_center() }, 100);
      }      
      return;
    }
    console.error(t.divId)

    let horizontal_expansion = t.params.horizontal_expansion;
    let nw = t.p_nw;
    let nh = t.p_nh;

    let i_aspect = nw / nh;
    let available_width = document.documentElement.clientWidth;
    let available_height = document.documentElement.clientHeight - this.#top_i_margin  - this.#bottom_i_margin;
    let available_aspect = available_width / available_height;


	i.style.position="fixed";
    if(horizontal_expansion) {
	  
	  if(i_aspect>available_aspect) {
	  	// limito el ancho
	   	i.style.width = available_width+"px";
	   	i.style.height = "auto";
	   	i.style.left="0px";
	   	i.style.top="50%";
	   	i.style.transform="translateY(-50%)";
	    	
	  } else {
	   	// limito el alto
	   	i.style.width = "auto";
	   	i.style.height = available_height+"px";
	   	i.style.top=this.#top_i_margin+"px";
	   	i.style.left="50%";
	   	i.style.transform="translateX(-50%)";
	   	//////i.style.left=0;
	  }
    } else {
      available_width = Math.round(t.div.getBoundingClientRect().width);	
	  available_aspect = available_width / available_height;
	  i.style.left=t.div.getBoundingClientRect().x+"px";
	  i.style.width=available_width+"px";
      i.style.top="50%";
	  i.style.transform="translateY(-50%)";
	  i.style.height="auto";
    }

    i.style.visibility="visible";

  }

  #getScrollbarWidth() {
    // Create a temporary, off-screen div
    const scrollDiv = document.createElement("div");
    scrollDiv.style.visibility = "hidden";
    scrollDiv.style.overflow = "scroll";
    scrollDiv.style.position = "absolute";
    scrollDiv.style.top = "-9999px";
    scrollDiv.style.width = "100px";
    scrollDiv.style.height = "100px";
  
    document.body.appendChild(scrollDiv);
  
    // Create an inner div and append it
    const innerDiv = document.createElement("div");
    innerDiv.style.width = "100%";
    scrollDiv.appendChild(innerDiv);
  
    // Measure the difference
    const scrollbarWidth = scrollDiv.offsetWidth - innerDiv.offsetWidth;
  
    // Cleanup
    document.body.removeChild(scrollDiv);
  
    return scrollbarWidth;
  }





}

//ADZONE-NOMINIFY

