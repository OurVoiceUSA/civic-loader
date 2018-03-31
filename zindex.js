
import redis from 'redis';
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

async function indexObj(obj, id) {
  if (obj == null) return;
  Object.getOwnPropertyNames(obj).forEach((prop) => {
    rc.sadd('zindex:'+obj[prop], id);
  });
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

  let pols = await rc.keysAsync('politician:*');

  for (let pid in pols) {
    let politician_id = pols[pid].split(":")[1];

    let pol = await rc.hgetallAsync('politician:'+politician_id);
    indexObj(pol, politician_id);

    let fec = await rc.hgetallAsync('fec:'+pol.fec_candidate_id);
    indexObj(fec, politician_id);

    let uslc = await rc.hgetallAsync('uslc:'+pol.uslc_id);
    indexObj(uslc, politician_id);

    let ep = await rc.hgetallAsync('everypolitician:'+pol.everypolitician_id);
    indexObj(ep, politician_id);

    let os = await rc.hgetallAsync('openstates:'+pol.openstates_id);
    indexObj(os, politician_id);
  }

  process.exit(0);

});

function missingConfig(item) {
  let msg = "Missing config: "+item;
  console.log(msg);
  process.exit(1);
}

