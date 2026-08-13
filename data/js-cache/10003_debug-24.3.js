// 10003_debug-24.3
// v 29
// 2026-May-26 15:44:54

(function(t) {
 
t.d.values={},
t.d.s = function(k,v) { adzone.e.values[k] = v; };
t.d.g = function(k) { return adzone.e.values[k] || null; };
t.d.overlay_txt = {};

  t.d.dynamic_sort = function(property) {
    var sortOrder = 1;
    if(property[0] === "-") {
        sortOrder = -1;
        property = property.substr(1);
    }
    return function (a,b) {
        var result = (a[property] < b[property]) ? -1 : (a[property] > b[property]) ? 1 : 0;
        return result * sortOrder;
    };
  };
   
t.d.setup = function() {
  
  t.d.setup_done = 1;
  
  var l = document.createElement("link");
  l.href = "https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap";
  l.rel = "stylesheet";
  document.head.appendChild(l);

  var l2 = document.createElement("link");
  l2.href = "https://fonts.googleapis.com/css2?family=Quicksand:wght@400;600;700&display=swap";
  l2.rel = "stylesheet";
  document.head.appendChild(l2);
  
  document.querySelector("adzone-debug-c") && document.querySelector("adzone-debug-c").remove();
  let d = document.createElement("div");
  d.id="adzone-debug-c";
  d.innerHTML=`
<style>
#adzone-debug-c *::before, #adzone-debug-c *::after { box-sizing: unset!important }
#adzone-debug-c b { font-weight:700!important;color:black!important }
#adzone-debug-c a { color:black!important }
#adzone-debug-c { overflow:-x:hidden!important; font-family:Roboto!important;font-size:13px!important;z-index:100000000!important;position:fixed!important; top:10px!important;left:10px!important;height:calc(100dvh - 20px)!important;
    width:calc(100vw - (100vw - 100%) - 20px)!important;background-color:white!important;border:0!important;border-radius:4px!important; }
#adzone-debug-c #adzone-debug-header{ width:100%!important; display:inline-block!important; line-height:50px!important;background-color:white!important; padding:0px!important; font-size:20px!important; }
#adzone-debug-c #adzone-debug-header div {font-weight:700!important; font-family:Quicksand!important;color:black!important}
#adzone-debug-c #adzone-debug-body { clear:both!important; height:calc(100vh - 65px)!important; background-color:#eee!important; overflow:auto!important; color:#000!important; line-height:20px!important; border:1px solid #999!important; }
#adzone-debug-c #adzone-debug-body * { font-family:Roboto!important; }
#adzone-debug-c #adzone-debug-body table { clear:both!important; width:calc(100% - 20px)!important; margin: 0 10px!important; border-collapse:collapse!important;table-layout:auto!important }
#adzone-debug-c #adzone-debug-body table thead { background-color:#ccc!important; border:1px solid #666!important; }
#adzone-debug-c #adzone-debug-body table thead th { text-shadow:none!important; color:black!important; line-height:30px!important; padding: 0 10px!important; font-family:Quicksand!important; font-weight:700!important; letter-spacing:0!important; text-transform:none!important; font-size:14px!important}
#adzone-debug-c #adzone-debug-body table td { text-shadow:none!important; color:black!important; height:30px!important; border-bottom:1px solid #ccc!important;padding:0 10px!important; vertical-align:middle!important; font-size:13px!important;text-align:left!important;overflow:hidden!important;letter-spacing:0!important; text-transform:none!important }
#adzone-debug-c #adzone-debug-body table td a:hover { color:#FF6D69!important; text-decoration:underline!important; }
#adzone-debug-c #adzone-debug-body .filled { background-color:#4CAF5033!important; }
#adzone-debug-c #adzone-debug-body .unfilled { background-color:#FFDFBA!important; }
#adzone-debug-c #adzone-debug-body .lazy_load { background-color:#BAE1FF99!important; }
#adzone-debug-c #adzone-debug-body .new_request { border-top:2px solid #aaa!important; }
#adzone-debug-c #adzone-debug-body table tr:hover { background-color:white!important; }
#adzone-debug-c #adzone-debug-top { margin: 5px 20px!important; }

#adzone-title-logo-mob {display:none!important; float:left!important; line-height:30px!important;margin-top:10px!important }
#adzone-title-logo-dsk {display:inline-block!important; float:left!important; line-height:30px!important;margin-top:10px!important }
#adzone-debug-c #adzone-buttons { float:right!important; }
#adzone-debug-c .adzone-button { font-family:Quicksand!important;font-size:16px!important;font-weight:700!important; float:right!important;cursor:pointer!important;line-height:26px!important;margin:10px 10px 0 0px!important;border:1px solid #ccc!important;border-radius:4px!important;padding:0 10px 2px 10px!important;background-color:#eee!important; }

@media only screen and (max-width: 800px) {
  #adzone-title-logo-mob{display:inline-block!important; }
  #adzone-title-logo-dsk{display:none!important; }
  #adzone-debug-c .adzone-button{font-size:14px!important;padding:0 5px!important;margin:10px 10px 0 0!important; }
}
@media only screen and (max-width: 380px) {
  #adzone-debug-c #adzone-debug-header{ padding:0!important; }
}
#adzone-debug-c .adzone-draft { background-color:orange!important; color:white!important; }

.adzone-overlay {color:black!important;line-height:14px!important; position: absolute!important; bottom: 0!important; 
left: 0!important; width: 100%!important; text-align: left!important; padding: 4px 10px!important; 
background-color: #bae1ffeb!important; font-family: Arial!important; font-size: 11px!important; font-weight: bold!important; overflow: hidden!important; border-radius:8px!important; }

</style>
<div id='adzone-debug-header'>
<img style='margin:9px 0 0 20px!important;height:28px!important;width:138px!important;float:left!important' src="data:image/png;base64,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">

<div id='adzone-buttons'>
  <div class='adzone-button' onclick="adzone.d.close()">&nbsp;X&nbsp;</div>
  <div class='adzone-button' onclick="adzone.d.simulate()">SIM</div>
  <div class='adzone-button' onclick="adzone.d.cancel_debugger()">CANCEL</div>
  <div id="adzone-draft-button" onclick="adzone.d.toggle_draft(true)" class='adzone-button'>Draft OFF</div>
</div>
</div>
<div id='adzone-debug-body'></div>
`;
  document.body.appendChild(d);
  t.d.toggle_draft(false);
};
t.d.cancel_debugger = function() {
  localStorage.removeItem("adzone-debug");
  localStorage.removeItem("adzone-draft");
  adzone.d.close();
  let url = document.location.href.replace("adzone-debug=","adzone-deb=").replace("adzone-draft=","adzone-dra=");
  document.location.href = url;
}
t.d.close = function() {
  t.d.is_opened = false;
  document.getElementById("adzone-debug-c").style.display="none";
}

t.d.process_events = function() {

  Object.keys(t.d.requests).forEach(function(key, index) {
    let r = t.d.requests[key];
    for(let i2=0;i2<r.events.length;i2++) {
      if(!r.events[i2].processed) {
        let e = r.events[i2];
        let ev = e.event;
        e.processed = 1;
        e.ad_unit_path = ev.slot.getAdUnitPath();
        e.advertiser_id = ev.advertiserId || "";
        e.campaign_id = ev.campaignId || "";
        e.lineitem_id = ev.lineItemId || "";
        e.creative_id = ev.creativeId || "";
        e.is_empty = ev.isEmpty;
        if(!ev.campaignId) { e.size = "unfilled"; }
        else if(!ev.size) { e.size = "N/A"; }
        else if(typeof ev.size == "string" && ev.size.toLowerCase()=="fluid") { e.size = "Fluid"; }
        else if(ev.size[1]) { e.size = ev.size[0]+"x"+ev.size[1]; }
        else { e.size = ev.size[0]; }
        e.ad_type = e.slot_data.ad_type;
        e.sizes_str = e.slot_data.sizes_str;
        e.slot_keys = t.d.get_slot_targeting_keys(ev.slot);
        t.d.requests[key].events[i2] = e;
      }
    }  
  });
};

t.d.get_slot_targeting_keys = function(slot) {
  var keys = {};

  try {
    var cfg = slot.getConfig("targeting") || {};
    var targeting = cfg.targeting || {};

    Object.keys(targeting).forEach(function(k) {
      keys[k] = targeting[k] || [];
    });

  } catch(e) { }

  return keys;
};

t.d.get_request_targeting_keys = function() {
  var keys = {};

  try {
    var cfg = googletag.getConfig("targeting") || {};
    var targeting = cfg.targeting || {};

    Object.keys(targeting).forEach(function(k) {
      keys[k] = targeting[k] || [];
    });

  } catch(e) { }

  return keys;
};


t.d.print_page = function() {
  document.getElementById("adzone-debug-c").style.display="";
  t.d.process_events();
    
  t.d.slots_printed = [];
  let sorted = [];
  
  let screen_size = (t.is_mobile ? (screen.width+"x"+screen.height) : (window.innerWidth+"x"+window.innerHeight));
  t.d.is_mobile = (t.is_mobile ? screen.width : window.innerWidth)<800;
  
  let page_kv = t.d.get_keys(t.d.get_request_targeting_keys());
  let html = `<div id='adzone-debug-top'>
    <b>`+ t.code + "&nbsp;" + t.version + "</b>&nbsp;&nbsp;&nbsp;" + document.location.href + `<br>
    `+ screen_size + ` - `+ navigator.userAgent + `<br>
    Page Key/Values: ` + page_kv + "</div>" ;
    
  if(!t.d.is_mobile) {
  html += "<table><thead><tr><th>Request</th>"
        + "<th nowrap>Ad slot (ad-type)</th>"
        + "<th>AV</th>"
        + "<th>Ad unit Path</th>"
        + "<th>Requested Sizes</th>"
        + "<th>Ad Size</th>"
        + "<th>Order</thd>"
        + "<th>Line&nbsp;Item</th>"
        + "<th>Creative</th>"
        + "<th>Key/Values</th>"
        + "</tr></thead>";
  }
  
  Object.keys(t.d.requests).forEach(function(i, index) {
    sorted.push(t.d.requests[i]);
  });
  sorted.sort(t.d.dynamic_sort("order"));  
  
  let count=0;
  Object.keys(sorted).forEach(function(key, index) {
    count++;
    let r = sorted[key];
    html += t.d.get_lines(r.order+1, r.rendered_time, r.events);
  });
  html += t.d.lazyload_slots();
  document.querySelector("#adzone-debug-body").innerHTML=html;
};

t.d.lazyload_slots = function() {
  let events = [];
  t.slots && Object.keys(t.slots).forEach(function(i, index) {
    let s=t.slots[i];
    if(!t.d.slots_printed.includes(i) && s.path) {
      let e = {};
      e.slot_id = i;
      e.ad_unit_path = s.path;
      e.advertiser_id = "";
      e.campaign_id = "";
      e.lineitem_id = "";
      e.creative_id = "";
      e.is_empty = "";
      e.size = "";
      e.ad_type = s.ad_type;
      e.sizes_str = s.sizes_str;
      e.slot_keys = s.kv;
      events.push(e);
    }
  });  
  return (events.length?t.d.get_lines(0,"",events):"");
};

t.d.print_overlay = function() {
  let ov=document.querySelectorAll(".adzone-overlay");
  for(let i=0; i<ov.length; i++) {
    ov[i].remove()
  }
  let divs=document.querySelectorAll(".ad-slot");
  for(let i=0; i<divs.length; i++) {
    try {
    let s=divs[i];
    let d = document.createElement("div");
    d.classList.add("adzone-overlay");
    let txt = "";
    if(t.d.overlay_txt["ad-slot-" + s.id]) { txt = t.d.overlay_txt["ad-slot-" + s.id]; 
    } else if(t.d.overlay_txt[s.id]) { txt = t.d.overlay_txt[s.id]; }
    d.innerHTML = txt;
    if(txt) {
      if(!s.style.position) {
        s.style.position="relative";    
      }
      s.appendChild(d);
    }
    } catch(e) { console.error(e); }
  }
}

  t.d.fix_links = function(r) {
    if(r.ad_unit_path.split("/").length>0 && r.ad_unit_path.split("/")[1]>0) {
      var network_id = r.ad_unit_path.split("/")[1];
      r.campaign_id > 0 && (r.campaign_id = "<a target='_blank' href='https://admanager.google.com/" + network_id + "?pli=1#delivery/order/order_overview/order_id=" + r.campaign_id + "'>" + r.campaign_id + "</a>");
      r.lineitem_id > 0 && r.creative_id > 0 && (r.creative_id = "<a target='_blank' href='https://admanager.google.com/" + network_id + "?pli=1#delivery/line_item_creative_association/detail/line_item_id=" + r.lineitem_id + "&creative_id=" + r.creative_id + "&li_tab=creatives'>" + r.creative_id + "</a>");
      r.lineitem_id > 0 && (r.lineitem_id = "<a target='_blank' href='https://admanager.google.com/" + network_id + "?pli=1#delivery/line_item/detail/line_item_id=" + r.lineitem_id + "'>" + r.lineitem_id + "</a>");

    }
    return r;
  };
  
  t.d.get_keys = function(keys) {
    var out = "";
    Object.keys(keys).forEach(function(i, index) {
      out += (out?"<span>&nbsp;&nbsp; </span>":"")+"<span style='font-weight:600!important'>" + i + "</span>:&nbsp;";
      var k = keys[i];
      if((typeof k === 'string' || k instanceof String)) {
        out += '<span style="font-weight:400!important">'+k+'</span>';
      } else if(k.length==1) {
        out += '<span style="font-weight:400!important">'+k[0]+'</span>';
      } else {
        out += "[";
        Object.keys(k).forEach(function(i2, index2) {
          out += (i2>0?"<b>,</b> ":"") + '<span style="font-weight:400!important">'+k[i2]+'</span>';
        });
        out += "]";
      }
    });
    return out;
  }



  t.d.get_lines = function(order, rendered_time, events) {
    
    let html = "";
    let sorted = [];
    let line_item_list = [];
    let creative_list = [];
    Object.keys(events).forEach(function(i, index) {
      sorted.push(events[i]);
    });
    sorted.sort(t.d.dynamic_sort("slot_id"));

    for(let i=0; i<sorted.length; i++) {
      //let o = JSON.parse(JSON.stringify(sorted[i]));

      let request_txt = "Not Loaded";
      if(order) {
        request_txt = (i==0?`Req. `+order+` -  `+(rendered_time/1000)+`s <br>`:"");
      }
      
      let new_request_class = (i==0?"new_request":"");
      
      let e = t.d.fix_links(sorted[i]);

      let status = "filled"
      if(e.size=="unfilled" && !e.campaign_id) {
        status = "unfilled"
      } else if(!e.campaign_id) {
        status = "lazy_load";
      }
      
      let short_id = e.slot_id.substring(0,8)=="ad-slot-" ? e.slot_id.substring(8) : e.slot_id;
      t.d.slots_printed.push(e.slot_id);
      let k_v = t.d.get_keys(e.slot_keys);
      let ad_type = (e.ad_type && e.ad_type!=="" ? " ("+ e.ad_type + ")":"");
      if(t.d.is_mobile) {
        html += "<div class='"+status+" "+new_request_class+"' style='padding:5px 20px!important;border-bottom:2px solid #ccc!important'>"
        + "<div><span style='font-weight:700!important; font-size:14px!important'>"+ short_id + "</span>" + ad_type + " <b>" + request_txt + "</b>"
        + "<div style='float:right;font-weight:700!important; font-size:14px!important;color:green!important;margin-left:20px!important'>"+(e.view?"AV":"")+"</div></div>"
        + "<div style='font-size:12px!important'>"+e.ad_unit_path+"</div>"
        + "<div style='font-size:12px!important'><b>Req</b>:"+e.sizes_str+"</div>"
        + "<div><span style='font-weight:700!important'><b>Delivered</b>: "+e.size+"</span></div>"
        + "<div><b>Or</b>: "+e.campaign_id+" <b>Li</b>:"+e.lineitem_id+" <b>Cr</b>: "+e.creative_id+"</div>"
        + (k_v ? "<div><b>K/V</b>:"+k_v+"</div>":"")
        + "</div>";
          
      } else {
        html += "<tr class='"+status+" "+new_request_class+"'>"
        + "<td>" + request_txt +"</td>"
        + "<td><span style='font-weight:700!important; font-size:14px!important'>"+ short_id + "</span>" + ad_type + "</td>"
        + "<td style='font-weight:700!important; font-size:14px!important;color:green!important'>"+(e.view?"AV":"")+"</td>"
        + "<td style='font-size:12px!important'>"+e.ad_unit_path+"</td>"
        + "<td style='font-size:12px!important'>"+e.sizes_str+"</td>"
        + "<td><span style='font-weight:700!important;text-align:center!important'>"+e.size+"</span></td>"
        + "<td style='text-align:center!important'>"+e.campaign_id+"</td>"
        + "<td style='text-align:center!important'>"+e.lineitem_id+"</td>"
        + "<td style='text-align:center!important'>"+e.creative_id+"</td>"
        + "<td>"+k_v+"</td>"
        + "</tr>";
      }
      
      t.d.overlay_txt["ad-slot-" + short_id] = short_id + " " + ad_type + " " + e.size + "<br>" + e.ad_unit_path; 
    }
    t.d.print_overlay();
    return html;
  };

t.d.simulate = function() {
  let loc = window.location.href;
  window.location.href = loc.replace("force-slots=1") + (loc.indexOf("?")>0?"&":"?") + "adzone-force=1";
}
t.d.toggle_draft = function(change) {
  let is_draft = localStorage.getItem("adzone-draft");
  if(change) {
    if(localStorage.getItem("adzone-draft")) {
      localStorage.removeItem("adzone-draft");
      is_draft = false;
    } else {
      localStorage.setItem("adzone-draft", 1);
      is_draft = true;
    }
    window.location.reload();
    return;
  }
  if(is_draft) {
    document.querySelector("#adzone-draft-button").classList.add("adzone-draft");
    document.querySelector("#adzone-draft-button").innerHTML = "Draft ON";
  } else {
    document.querySelector("#adzone-draft-button").classList.remove("adzone-draft");  
    document.querySelector("#adzone-draft-button").innerHTML = "Draft OFF";
  }
}

!t.d.setup_done && t.d.setup();
t.d.print_page();
t.d.is_opened = true;

//let s = document.createElement("style");
//s.innerHTML = ".ad-slot { display:inline-block!important }";
//document.body.appendChild(s);

})(adzone);



//ADZONE-NOMINIFY
