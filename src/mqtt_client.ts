import { Logger, PlatformConfig } from 'homebridge';
import { connect, Client } from "mqtt"

export class MqttClient {
    public readonly client: Client
    public readonly log: Logger

    constructor(public readonly logger: Logger,
                public readonly config: PlatformConfig) 
    {
        let client = connect(config.mqtt.server)
        client.on('connect', function () {
            logger.info('mqtt connected');
        });
        this.log = logger
        this.client = client;
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

    processMessage(char, topicDefines, topic, message) {
        const log = this.log;
        const payload = JSON.parse(message);

        if (topicDefines.get == topic) {
            char.updateValue(payload.value);
            log.info(char.displayName + ' value updated to ' + payload.value);
        }
        Object.keys(topicDefines.props || {}).forEach(propKey => {
            if (topicDefines.props[propKey] == topic) {
                char.setProps({
                    [propKey]: payload.value,
                });
                log.info(char.displayName + ' ' + propKey + ' updated to ' + payload.value);
            }
        });
    }

    subscribeTopics(char, topicDefines) {
        const client = this.client;
        const log = this.log;

        client.subscribe(topicDefines.get, (err) => {
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