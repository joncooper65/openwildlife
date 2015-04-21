require.config({
  paths:{
    "jquery": "../vendor/jquery/jquery.min",
    "jquerymobile": "../vendor/jquery-mobile-bower/js/jquery.mobile-1.4.2.min",
    "leaflet": "../vendor/leaflet/dist/leaflet",
    "underscore": "../vendor/underscore/underscore-min"
  }
});

require(["jquery", "jquerymobile", "leaflet", "underscore"], function($, jquerymobile, L, _){
  $(document).ready(function() {
    var map;
    var hasOpenPopups = false;
    var isVernacularNames = false;//Show either vernacular (true) names in popup, or else scientific
    initialise();

    function initialise(){
      var openStreetMap = 
      L.tileLayer("http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", 
        {
          minZoom: 1, 
          maxZoom: 17, 
          attribution: "Map data copyright <a href='http://openstreetmap.org'>OpenStreetMap</a> contributors"
        });

      map = L.map("map",{
        dragging: true,
        touchZoom: true,
        tap: false,
        inertia: true,
        inertiaDeceleration: 3000,
        inertiaMaxSpeed: 1500,
        tap: true,
        layers: [openStreetMap]
      });
      map.locate({setView: true, zoom: 5});
      map.on("locationfound", onLocationFound);
      map.on("locationerror", onLocationError);
    }

    function onLocationFound(e){
      addRecords();

      map.on("movestart", function(e){});

      map.on("move", function(e){});

      map.on("moveend", function(e){
      	addRecords();
      });

    }

    function addRecords(){
      if(!hasOpenPopups){
        var url = getGbifQuery();
        $.ajax({
            type: 'GET',
            url: url,
            async: false,
            jsonpCallback: 'processtoReturn',
            contentType: "application/json",
            dataType: 'jsonp',
            success: function(json) {
                console.dir('Total number of toReturn: ' + json.count);
                removeCurrentMarkers();
                L.geoJson(getGeojson(json.results), {
                    onEachFeature: onEachFeature
                }).addTo(map);
            },
            error: function(e) {
                console.log(e.message);
            }
        });
      }
    }

    function getGbifQuery(){
        bounds = map.getBounds();
        return 'http://api.gbif.org/v1/occurrence/search?decimalLongitude=' 
                     + bounds.getWest() + ',' + bounds.getEast() + '&'
                     + '&decimalLatitude=' + bounds.getSouth() + ',' + bounds.getNorth()
                     + '&hasCoordinate=true'
                     + '&limit=300'
                     + '&callback=processtoReturn';
    }

    /*
    * Remove the current species markers only if there are no popups open.
    * Note: it seems that the simplest way to detect if a layer on the map 
    * is a species layer is to try to throw an exception by accessing the
    * nested 'species' property.
    */
    function removeCurrentMarkers(){
       if(!hasOpenPopups){
         map.eachLayer(function(layer){
          try{
            if(!_.isUndefined(layer.feature.properties.species)){
              map.removeLayer(layer);
            }
          }catch(e){
            //Do nothing, since this was only thrown because the layer does not
            //have the nested 'species' property we were looking for
          }
         });
       }
    }

    function onLocationError(e){
      alert(e.message);
    }

    function handlePopupOpen(event){
      hasOpenPopups = true;
      event.popup.setContent('Getting species...');
      if(isVernacularNames){
        populatePopupWithVernacular(event.popup, event.target.feature.properties.species);
      }else{
        event.popup.setContent(getPopupContentScientific(event.target.feature));
      }
    }

    function handlePopupClose(event){
      hasOpenPopups = false;
    }

    function onEachFeature(feature, layer){
      var popup = L.popup({
          maxWidth:200,
          maxHeight: 300,
          autoPan: true,
          keepInView: true
        }, layer);
      layer.bindPopup(popup);

      layer.on('popupopen', handlePopupOpen);
      layer.on('popupclose', handlePopupClose);
    }

    /*This takes the raw results from gbif and returns an array of geojson objects.
    * The geojson objects of the array are unique on lat/long and contain the properties required
    * for the placemarker - species list, species keys, latest year a property 
    * that is an array of species names found at that location.
    */
    function getGeojson(results){
      var geojsonResults = {};
      _.each(results, function(gbifSpecies){
        if(gbifSpecies.hasOwnProperty('species')){//Don't do it if this gbif record is not a species (ie might be higher taxon level)
          var geohash = gbifSpecies.decimalLongitude + '' + gbifSpecies.decimalLatitude;
          if(geojsonResults.hasOwnProperty(geohash)){
            updateSpecies(gbifSpecies, geojsonResults[geohash].properties.species);
          }else{
            geojsonResults[geohash] = {
              "type": "Feature",
              "geometry": {"type": "Point", "coordinates": [gbifSpecies.decimalLongitude, gbifSpecies.decimalLatitude]},
              "properties": {"species": []}
            };
            geojsonResults[geohash].properties.species.push(getSpeciesFromGbif(gbifSpecies));
          }
        }
      });
      _.each(geojsonResults, function(elem){
        elem.properties.species = _.sortBy(elem.properties.species,'name');
      });
      var toReturn = [];
      _.map(geojsonResults, function(elem){
        toReturn.push(elem);
      });
      return toReturn;
    }
  });

  function updateSpecies(gbifSpecies, speciesArray){
    var species = _.findWhere(speciesArray, {taxonKey: gbifSpecies.taxonKey})
    if(_.isUndefined(species)){
      speciesArray.push(getSpeciesFromGbif(gbifSpecies));
    }else{
      if(!_.contains(species.datasetKeys, gbifSpecies.datasetKey)){
        species.datasetKeys.push(gbifSpecies.datasetKey);
      }
      if(species.year < gbifSpecies.year){
        species.year = gbifSpecies.year;
      }
    }
  }

  function getSpeciesFromGbif(gbifSpecies){
    var species = {"taxonKey": gbifSpecies.taxonKey, "name": gbifSpecies.species, "year": gbifSpecies.year, "datasetKeys": []};
    species.datasetKeys.push(species.datasetKey);
    return species;
  }

  function populatePopupWithVernacular(popup, speciess){
    var deferreds = [];
    _.each(speciess, function(species){
      deferreds.push(getVernacularName(species.taxonKey));
    });
    $.when.apply($, deferreds).done(function(){
      var vernacularNames = [];
      var scientificNames = [];
      _.each(deferreds, function(deferred){
        if(typeof deferred.responseJSON.vernacularName === "undefined"){
          scientificNames.push('<i>' + firstToUpper(deferred.responseJSON.species) + '</i>');
        }else{
          vernacularNames.push(firstToUpper(deferred.responseJSON.vernacularName));
        }
      });
      vernacularNames.sort();
      scientificNames.sort();
      var content = '';
      _.each(vernacularNames, function(name){
        content = content + name + '<br />';
      });
      if(!_.isEmpty(scientificNames)){
        content = content + '<h4 class="scientific-name-heading">Species without common names:</h4>';
        _.each(scientificNames, function(name){
          content = content + name + '<br />';
        });
      }
      popup.setContent(content);
    });
  }

  function firstToUpper(string){
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  function getVernacularName(taxonKey){
    var url = 'http://api.gbif.org/v1/species/' + taxonKey;
    return $.ajax({
      type: 'GET',
      url: url,
      async: true,
      contentType: "application/json",
      dataType: 'jsonp',
    });
  }

  function getPopupContentScientific(feature){
    var popupContent = '<div class="popup-content">';
     if(feature.properties && feature.properties.species){
        _.each(feature.properties.species, function(species){
          popupContent = popupContent + species.name + ' (' + species.year + ')<br \>';
        });
      }
    popupContent = popupContent + '</div>';
    return popupContent;
  }

});
