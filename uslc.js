
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
      "https://theunitedstates.io/congress-legislators/legislators-current.json",
      {compress: true}
    );
    const json = await response.json();

    for (let i in json) {
      let obj = json[i];
      // transform depth into one object, last item in terms is current
      let uslc = Object.assign(obj.id, obj.name, obj.bio, obj.terms.pop());

      try {

        let div = 'ocd-division/country:us/state:'+uslc.state.toLowerCase()+((uslc.type == 'rep' && uslc.district)?'/cd:'+uslc.district:'');

        let dname = await rc.hgetAsync('division:'+div, 'name');
        if (!dname) throw "Incorrect division "+div;

        uslc.politician_id = sha1(div+":"+uslc.last.toLowerCase().trim()+":"+uslc.first.toLowerCase().trim());

        // convert party data
        switch (uslc.party) {
          case 'Democrat': uslc.party = 'D'; break;
          case 'Republican': uslc.party = 'R'; break;
          case 'Green': uslc.party = 'G'; break;
          case 'Libertarian': uslc.party = 'L'; break;
          case 'Independent': uslc.party = 'I'; break;
          default: uslc.party = 'U';
        }

        // convert array that redis won't like
        uslc.fec_id = uslc.fec.pop();
        delete uslc.fec;

        // remove null keys
        cleanobj(uslc);

        rc.hmset('uslc:'+uslc.bioguide, uslc);
        rc.hmset('politician:'+uslc.politician_id, 'uslc_id', uslc.bioguide);
        } catch (e) {
          console.log("Unable to import Openstates record: %j", uslc);
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

