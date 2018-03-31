
import redis from 'redis';
import fetch from 'node-fetch';
import pifall from 'pifall';
import sha1 from 'sha1';

import GoogleSpreadsheets from 'google-spreadsheets';

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

  GoogleSpreadsheets.rows({
    key: '1r9QgnLDuopGDJB-_wLcOpaD1DEEbB-0El8yankqWe-0',
    worksheet: 1,
  }, async function(e, s) {

    for (let o in s) {
      let obj = s[o];

      try {
        let div = obj.ocdid;
        let dname = await rc.hgetAsync('division:'+div, 'name');
        if (!dname) throw "Incorrect division "+div;

        let politician_id = sha1(div+":"+obj.lastname+":"+obj.firstname);

        let cfar = {
          lastname: obj.lastname,
          firstname: obj.firstname,
          emailaddress: obj.emailaddress,
          ocdid: obj.ocdid,
        };

        rc.hmset('cfar:'+politician_id, cfar);
      } catch(e) {
        console.log("Unable to import cfar record: %j", cfar);
        console.log(e);
      }
    }

    process.exit(0);
  });

});

function missingConfig(item) {
  let msg = "Missing config: "+item;
  console.log(msg);
  process.exit(1);
}

