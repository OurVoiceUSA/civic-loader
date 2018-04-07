
import redis from 'redis';
import fetch from 'node-fetch';
import pifall from 'pifall';
import sha1 from 'sha1';

const ovi_config = {
  redis_host: ( process.env.REDIS_HOST ? process.env.REDIS_HOST : 'localhost' ),
  redis_port: ( process.env.REDIS_PORT ? process.env.REDIS_PORT : 6379 ),
};

// async'ify redis
pifall(redis.RedisClient.prototype);
pifall(redis.Multi.prototype);

function cleanobj(obj) {
  for (var propName in obj) {
    if (obj[propName] == '' || obj[propName] == null)
      delete obj[propName];
  }
}

// redis connection
var rc = redis.createClient(ovi_config.redis_port, ovi_config.redis_host,
  {
    // endlessly retry the database connection
    retry_strategy: function (options) {
      console.log('redis connection failed to "'+ovi_config.redis_host+'", retrying: this is attempt # '+options.attempt);
      return Math.min(options.attempt * 100, 3000);
    }
  }
);

rc.on('connect', async function() {
  console.log('Connected to redis at host "'+ovi_config.redis_host+'"');

  try {

    const response = await fetch(
      "https://raw.githubusercontent.com/CivilServiceUSA/us-governors/master/us-governors/data/us-governors.json",
      {compress: true}
    );
    const json = await response.json();

    for (let i in json) {
      let csusa = json[i];

      try {

        let div = 'ocd-division/country:us/state:'+csusa.state_code.toLowerCase();

        let dname = await rc.hgetAsync('division:'+div, 'name');
        if (!dname) throw "Incorrect division "+div;

        csusa.politician_id = sha1(div+":"+csusa.last_name.toLowerCase().trim()+":"+csusa.first_name.toLowerCase().trim());
        csusa.divisionId = div;

        // convert party data
        switch (csusa.party) {
          case 'democrat': csusa.party = 'D'; break;
          case 'republican': csusa.party = 'R'; break;
          case 'green': csusa.party = 'G'; break;
          case 'libertarian': csusa.party = 'L'; break;
          case 'independent': csusa.party = 'I'; break;
          default: csusa.party = 'U';
        }

        csusa.office = 'Governor';
        csusa.address = csusa.address_complete;
        csusa.url = csusa.website;
        csusa.twitter = csusa.twitter_handle;
        if (csusa.facebook_url) csusa.facebook = csusa.facebook_url.split('/')[3];

        // remove null keys
        cleanobj(csusa);

        rc.hmset('csusa:'+csusa.bioguide, csusa);
        rc.sadd('politician:'+csusa.politician_id, 'csusa:'+csusa.bioguide);
        } catch (e) {
          console.log("Unable to import csusa record: %j", csusa);
          console.log(e);
        }

      }
  } catch (e) {
    console.log(e);
  }

  process.exit(0);
});

function missingConfig(item) {
  let msg = "Missing config: "+item;
  console.log(msg);
  process.exit(1);
}

