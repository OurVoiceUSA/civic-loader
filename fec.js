
import redis from 'redis';
import fetch from 'node-fetch';
import pifall from 'pifall';
import sha1 from 'sha1';

const ovi_config = {
  redis_host: ( process.env.REDIS_HOST ? process.env.REDIS_HOST : 'localhost' ),
  redis_port: ( process.env.REDIS_PORT ? process.env.REDIS_PORT : 6379 ),
  election_year: ( process.env.ELECTION_YEAR ? process.env.ELECTION_YEAR : missingConfig("ELECTION_YEAR") ),
  api_key_fec: ( process.env.API_KEY_FEC ? process.env.API_KEY_FEC : missingConfig("API_KEY_FEC") ),
  DEBUG: ( process.env.DEBUG ? true : false ),
};

// async'ify redis
pifall(redis.RedisClient.prototype);
pifall(redis.Multi.prototype);

async function dbwrap() {
    var params = Array.prototype.slice.call(arguments);
    var func = params.shift();
    if (ovi_config.DEBUG) {
      let funcName = func.replace('Async', '');
      console.log('DEBUG: '+funcName+' '+params.join(' '));
    }
    return rc[func](params);
}

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

  let page = 1;
  let pages = 0;

  try {
    do {
      const response = await fetch(
        "https://api.open.fec.gov/v1/candidates/search/?sort=name&per_page=100"+
        "&api_key="+ovi_config.api_key_fec+
        "&election_year="+ovi_config.election_year+
        "&page="+page,
        {compress: true}
      );
      const json = await response.json();

      if (!pages) pages = json.pagination.pages;
      page++;

      for (let i in json.results) {
        let fec = json.results[i];

        try {
          if (fec.office == 'P') continue; // not handling this yet

          let div = 'ocd-division/country:us/state:'+fec.state.toLowerCase()+(fec.office == 'H'?'/cd':'')+(fec.district_number?":"+fec.district_number:"");

          let dname = await rc.hgetAsync('division:'+div, 'name');
          if (!dname) throw "Incorrect division "+div;

          // FEC "name" is in format: LAST, FIRST MIDDLE TITLE  -- we only need first and last name
          let last_name = fec.name.split(",")[0].toLowerCase();
          let first_name = fec.name.split(", ")[1].split(" ")[0].toLowerCase();
          let politician_id = sha1(div+":"+last_name+":"+first_name);
          fec.politician_id = politician_id;

          // convert party data
          switch (fec.party) {
            case 'DEM': fec.party = 'D'; break;
            case 'REP': fec.party = 'R'; break;
            case 'GRE': fec.party = 'G'; break;
            case 'LIB': fec.party = 'L'; break;
            case 'DFL': fec.party = 'DFL'; break;
            case 'OTH': fec.party = 'O'; break;
            case 'W':
            case 'IND':
            case 'UN':
            case 'NNE':
            case 'NPA':
            case 'NON':
              fec.party = 'I'; break;
              break;
            default: fec.party = 'U';
          }

          // delete arrays that redis won't like
          delete fec.principal_committees;
          delete fec.election_districts;
          delete fec.election_years;
          delete fec.cycles;

          // remove null keys
          cleanobj(fec);

          rc.hmset('FEC:'+fec.candidate_id, fec);
          rc.hmset('politician:'+politician_id, 'fec_candidate_id', fec.candidate_id);
        } catch (e) {
          console.log("Unable to import FEC record: %j", fec);
          console.log(e);
        }
      }
    } while (page <= pages);
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

