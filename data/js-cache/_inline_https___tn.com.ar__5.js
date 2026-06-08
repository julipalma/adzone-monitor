let anchorSlot;
      googletag.cmd.push(() => {
        anchorSlot = googletag.defineOutOfPageSlot(
          "/113951150/tn-arc/home/zocalo", googletag.enums.OutOfPageFormat.BOTTOM_ANCHOR,
        );
        if(anchorSlot){
          anchorSlot.addService(googletag.pubads());
          if("homepage") {
            anchorSlot.setTargeting("seccion", "home");
            anchorSlot.setTargeting("sitioseccion", "tn-home");
          }
          if("") {
            anchorSlot.setTargeting("idnota", "");
          }
          googletag.pubads().enableSingleRequest();
          googletag.enableServices();
        }
      });