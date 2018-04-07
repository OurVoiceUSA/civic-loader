
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

var blacklist = ['politician_id', 'middle_name', 'address', 'phone', 'email', 'url', 'photo_url'];

async function indexObj(obj, id, key) {
  if (obj == null) return;
  Object.getOwnPropertyNames(obj).forEach((prop) => {
    let val = obj[prop].replace(/(?:\r\n|\r|\n|\t| |"|\\|)/g, '').toLowerCase();
    if (!blacklist.includes(prop))
      rc.sadd('zindex:'+val, id);
  });
  if (key) rc.sadd('zindex:'+key, id);
  if (obj.divisionId) {
    let div = await rc.hgetallAsync('division:'+obj.divisionId);
    indexObj(div, id, null);
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

  let keys = await rc.keysAsync('zindex:*');
  for (let k in keys)
    rc.del(keys[k]);

  let pols = await rc.keysAsync('politician:*');

  for (let pid in pols) {
    let politician_id = pols[pid].split(":")[1];

    let refs = await rc.smembersAsync('politician:'+politician_id);

    for (let r in refs) {
      let ref = refs[r];

      let src = ref.split(':')[0];
      let obj = await rc.hgetallAsync(ref);
      indexObj(obj, politician_id, src);
    }
  }

  process.exit(0);

});

function missingConfig(item) {
  let msg = "Missing config: "+item;
  console.log(msg);
  process.exit(1);
}

