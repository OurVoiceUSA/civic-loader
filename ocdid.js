
import redis from 'redis';
import fetch from 'node-fetch';
import csvjson from 'csvjson';

const ovi_config = {
  redis_host: ( process.env.REDIS_HOST ? process.env.REDIS_HOST : 'localhost' ),
  redis_port: ( process.env.REDIS_PORT ? process.env.REDIS_PORT : 6379 ),
};

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
      "https://raw.githubusercontent.com/opencivicdata/ocd-division-ids/master/identifiers/country-us.csv",
      {compress: true}
    );
    const csv = await response.text();
    const json = csvjson.toObject(csv, {});

/*
  Data ends up as an array of objects like this:

  {
    id: 'ocd-division/country:us',
    name: 'United States',
    sameAs: '',
    sameAsNote: '',
    validThrough: '',
    census_geoid: '',
    census_geoid_12: '',
    census_geoid_14: '',
    openstates_district: '',
    placeholder_id: '',
    sch_dist_stateid: '',
    state_id: '',
    validFrom: ''
  }

*/

    // for now, we're only interested in id and name - but make it an hmset for later on
    for (let i in json) {
      rc.del('division:'+json[i].id);
      rc.hmset('division:'+json[i].id, 'name', json[i].name);
    }

  } catch (e) {
    console.log(e);
    process.exit(1);
  }

  process.exit(0);
});

function missingConfig(item) {
  let msg = "Missing config: "+item;
  console.log(msg);
  process.exit(1);
}

