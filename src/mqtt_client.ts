import { Logger, PlatformConfig } from 'homebridge';
import { connect, Client } from "mqtt"

export class MqttClient {
    public readonly client: Client
    public readonly log: Logger

    constructor(public readonly logger: Logger,
                public readonly config: PlatformConfig) 
    {
        this.log = logger
        let handler_object = this
        let client = connect(config.mqtt.server)

        client.on('connect', function () {
            client.subscribe('zigbee2mqtt/Garrage Door', function (err) {
              if (!err) {
                logger.info('subscribed')
              }
            })
          })
        client.on('message', this.processMessage.bind(this));
        this.client = client
        // this.client.on('connect', function () {
        //     handler_object.handle_client_connect()
        // });
    }

    handle_client_connect() {
        this.log.info('mqtt connected');
        this.subscribeTopics('zigbe2mqtt/Garrage Door')
    }

    publishTopic(char, topicDefines, state, callback) {
        const client = this.client;
        const log = this.log;

        client.publish(topicDefines.set, JSON.stringify({
            value: state,
        }));
        log.info(char.displayName + ' set to ' + state);
        callback(null);
    }

    processMessage(char, message) {
        const log = this.log;
        const payload = JSON.parse(message);

        log.info('',message.toString())

        // if (topicDefines.get == topic) {
        //     char.updateValue(payload.value);
        //     log.info(char.displayName + ' value updated to ' + payload.value);
        // }
        // Object.keys(topicDefines.props || {}).forEach(propKey => {
        //     if (topicDefines.props[propKey] == topic) {
        //         char.setProps({
        //             [propKey]: payload.value,
        //         });
        //         log.info(char.displayName + ' ' + propKey + ' updated to ' + payload.value);
        //     }
        // });
    }

    subscribeTopics(topicDefines) {
        let client = this.client;
        let log = this.log;
        let a = ['topicDefines[0]']

        this.client.subscribe('khgk', function(err) {})
        this.client.subscribe(a, function(err) {
            if (!err) {
                log.info(topicDefines.get + ' subscribed');
            }
        });
        Object.keys(topicDefines.props || []).forEach(propKey => {
            client.subscribe(topicDefines.props[propKey], (err) => {
                if (!err) {
                    log.info(topicDefines.props[propKey] + ' subscribed');
                }
            });
        });
    }
}