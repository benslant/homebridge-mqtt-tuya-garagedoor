import { Logger, PlatformConfig } from 'homebridge';
import { connect, Client } from "mqtt"
import * as events from 'events'

export class Z2MMqttClient extends events.EventEmitter {
    public readonly client: Client
    public readonly log: Logger
    private readonly baseTopic: string
    private readonly displayName: string
    private readonly door_set_topic: string

    constructor(public readonly logger: Logger,
                public readonly config: PlatformConfig) 
    {
        super();
        this.log = logger
        let handler_object = this
        let client = connect(config.mqtt.server)
        this.baseTopic = config.mqtt.base_topic
        this.displayName = config.door.displayname
        const door_base_topic = `${this.baseTopic}/${this.displayName}`
        this.door_set_topic = `${door_base_topic}/set`

        const set_topic = this.door_set_topic

        client.on('connect', function () {
            client.subscribe(door_base_topic, function (err) {
              if (!err) {
                logger.info('subscribed to base topic')
              }
            })
            client.subscribe(set_topic, function (err) {
                if (!err) {
                  logger.info('subscribed to set topic')
                }
              })
          })
        client.on('message', this.processMessage.bind(this));
        this.client = client
    }

    handle_client_connect() {
        this.log.info('mqtt connected');
        this.subscribeTopics('zigbee2mqtt/Garage Door')
    }

    publishTopic(payload) {
        payload.sender = 'hb-tuya-garagedoor-accessory'
        this.client.publish(this.door_set_topic, JSON.stringify(payload));
    }

    processMessage(char, message, packet) {
        const log = this.log;
        const payload = JSON.parse(message);
        if(payload.sender && payload.sender == 'hb-tuya-garagedoor-accessory') return
        log.debug('packet: ', packet)

        if(payload.garage_door_contact != null)
            this.emit('garage_door_contact', payload.garage_door_contact)
        if(payload.trigger != null)
            this.emit('trigger', payload.trigger)
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