OpenWildlife
===========

An app to map widlife records delivered from Gbif rest services.

Point your device at this to see a recent iteration: http://joncooper65.github.io/openwildlife/

The vision is to have a location aware map sprinkled with interactive place markers displaying wildlife records.  The user can choose their preferences for common/scientific naming, earliest year and species group.  The placemarkers show species recorded there and the datasets they come from.  The map can be summarised to show common species, taxon group statistics, datasets accessed and date ranges.

The first iteration aims to take the Gbif services as far as they can go.  Since they aren't designed to support an app like this we want to find what works and what doesn't, and what further back end services are needed.  It will also drive out design and features we like.

dev notes
---------

npm install grunt

npm install grunt-contrib-uglify

npm install -g grunt-cli

grunt

Would like to move over to backbone, coffescript, freemarker and setup proper grunt tasks for building, dist, etc

mongodb install on linux: http://docs.monanual/tutorial/install-mongodb-on-ubuntu/
