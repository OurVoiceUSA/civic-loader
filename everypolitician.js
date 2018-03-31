
import redis from 'redis';
import fetch from 'node-fetch';
import pifall from 'pifall';
import sha1 from 'sha1';
import csvjson from 'csvjson';

const ovi_config = {
  redis_host: ( process.env.REDIS_HOST ? process.env.REDIS_HOST : 'localhost' ),
  redis_port: ( process.env.REDIS_PORT ? process.env.REDIS_PORT : 6379 ),
  term: ( process.env.USTERM ? process.env.USTERM : missingConfig("USTERM") ),
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

    const chambers = ["House", "Senate"];

    for (let c in chambers) {
      let chamber = chambers[c];
      let response = await fetch(
        "https://raw.githubusercontent.com/everypolitician/everypolitician-data/master/data/United_States_of_America/"+chamber+"/term-"+ovi_config.term+".csv",
        {compress: true}
      );
      let csv = await response.text();
      let json = csvjson.toObject(csv, {quote: '"'});

      for (let i in json) {

        let ep = json[i];

        try {

          let div = ep.area_id;

          let dname = await rc.hgetAsync('division:'+div, 'name');
          if (!dname) throw "Incorrect division "+div;

          // "sort_name" is in format: last, first
          let last_name = ep.sort_name.split(",")[0].toLowerCase().trim();
          let first_name = ep.sort_name.split(", ")[1].toLowerCase().trim();
          ep.politician_id = sha1(div+":"+last_name+":"+first_name);

          // convert party data
          switch (ep.group_id) {
            case 'democrat': ep.party = 'D'; break;
            case 'republican': ep.party = 'R'; break;
            case 'green': ep.party = 'G'; break;
            case 'libertarian': ep.party = 'L'; break;
            case 'other': ep.party = 'O'; break;
            case 'independent': ep.party = 'I'; break;
            default: ep.party = 'U';
          }

          // remove null keys
          cleanobj(ep);

          rc.hmset('everypolitician:'+ep.id, ep);
          rc.hmset('politician:'+ep.politician_id, 'everypolitician_id', ep.id);
        } catch (e) {
          console.log("Unable to import everypolitician record: %j", ep);
          console.log(e);
        }
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

