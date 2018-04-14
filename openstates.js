
import redis from 'redis';
import fetch from 'node-fetch';
import pifall from 'pifall';
import sha1 from 'sha1';

const ovi_config = {
  redis_host: ( process.env.REDIS_HOST ? process.env.REDIS_HOST : 'localhost' ),
  redis_port: ( process.env.REDIS_PORT ? process.env.REDIS_PORT : 6379 ),
  api_key_openstates: ( process.env.API_KEY_OPENSTATES ? process.env.API_KEY_OPENSTATES : missingConfig("API_KEY_OPENSTATES") ),
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
      "https://openstates.org/api/v1/legislators/",
      {compress: true, headers: {'X-API-KEY': ovi_config.api_key_openstates}}
    );
    const json = await response.json();

    for (let i in json) {
      let os = json[i];

      try {

        let div = 'ocd-division/country:us/state:'+os.state.toLowerCase()+'/'+(os.chamber == 'lower'?'sldl':'sldu')+':'+os.district;

        let dname = await rc.hgetAsync('division:'+div, 'name');
        if (!dname) throw "Incorrect division "+div;

        os.politician_id = sha1(div+":"+os.last_name.toLowerCase().trim()+":"+os.first_name.split(" ").shift().toLowerCase().trim());
        os.divisionId = div;

        // convert party data
        switch (os.party) {
          case 'Democratic': os.party = 'D'; break;
          case 'Republican': os.party = 'R'; break;
          case 'Green': os.party = 'G'; break;
          case 'Libertarian': os.party = 'L'; break;
          case 'Democratic-Farmer-Labor': os.party = 'DFL'; break;
          case 'Independent': os.party = 'I'; break;
          default: os.party = 'U';
        }

        // convert array that redis won't like
        os.address = ( Object.keys(os.offices).length ? os.offices[0].address : '' );
        os.phone = ( Object.keys(os.offices).length ? os.offices[0].phone : '' );
        delete os.offices;
        delete os.all_ids;
        delete os['+counties'];
        delete os['+district_offices'];
        delete os['+capitol_office'];

        // votesmart_id becomes votesmart
        os.votesmart = os.votesmart_id;
        delete os.votesmart_id;

        // remove null keys
        cleanobj(os);

        rc.hmset('openstates:'+os.id, os);
        rc.sadd('politician:'+os.politician_id, 'openstates:'+os.id);
        } catch (e) {
          console.log("Unable to import Openstates record: %j", os);
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

