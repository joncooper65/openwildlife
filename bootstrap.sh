#!/bin/sh

echo "About to install Apache2"
apt-get update
apt-get install -y apache2
if [ -d /var/www ]; then
  rm -rf /var/www
  echo 'cleaned out /var/www'
fi
mkdir /var/www
ln -fs /vagrant /var/www/html
echo 'pointed /var/www/html at /vagrant'
