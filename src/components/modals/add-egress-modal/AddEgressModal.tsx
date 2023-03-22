import {
  Badge,
  Button,
  Col,
  Divider,
  Form,
  Input,
  Modal,
  notification,
  Row,
  Select,
  Switch,
  Table,
  TableColumnProps,
  theme,
  Tooltip,
  Typography,
} from 'antd';
import { MouseEvent, useCallback, useMemo, useState } from 'react';
import { useStore } from '@/store/store';
import '../CustomModal.scss';
import { Network } from '@/models/Network';
import { Node } from '@/models/Node';
import { HostCommonDetails } from '@/models/Host';
import { getNodeConnectivityStatus } from '@/utils/NodeUtils';
import { CloseOutlined, PlusOutlined } from '@ant-design/icons';
import { extractErrorMsg } from '@/utils/ServiceUtils';
import { AxiosError } from 'axios';
import { NodesService } from '@/services/NodesService';
import { isValidIp } from '@/utils/NetworkUtils';
import { CreateEgressNodeDto } from '@/services/dtos/CreateEgressNodeDto';

interface AddEgressModalProps {
  isOpen: boolean;
  networkId: Network['netid'];
  onCreateEgress: () => any;
  closeModal?: () => void;
  onOk?: (e: MouseEvent<HTMLButtonElement>) => void;
  onCancel?: (e: MouseEvent<HTMLButtonElement>) => void;
}

type AddEgressFormFields = CreateEgressNodeDto & {
  nodeId: Node['id'];
};

export default function AddEgressModal({ isOpen, onCreateEgress, onCancel, networkId }: AddEgressModalProps) {
  const [form] = Form.useForm<AddEgressFormFields>();
  const [notify, notifyCtx] = notification.useNotification();
  const store = useStore();
  const { token: themeToken } = theme.useToken();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [egressSearch, setEgressSearch] = useState('');
  const [selectedEgress, setSelectedEgress] = useState<(Node & HostCommonDetails) | null>(null);
  const idFormField = 'nodeId';

  const getNodeConnectivity = useCallback((node: Node) => {
    if (getNodeConnectivityStatus(node) === 'error') return <Badge status="error" text="Error" />;
    else if (getNodeConnectivityStatus(node) === 'warning') return <Badge status="warning" text="Unstable" />;
    else if (getNodeConnectivityStatus(node) === 'healthy') return <Badge status="success" text="Healthy" />;
    else return <Badge status="processing" text="Unknown" />;
  }, []);

  const networkHosts = useMemo<(Node & HostCommonDetails)[]>(() => {
    return store.nodes
      .filter((node) => node.network === networkId)
      .map((node) => ({ ...node, ...store.hostsCommonDetails[node.hostid] }));
  }, [networkId, store.hostsCommonDetails, store.nodes]);
  const filteredNetworkHosts = useMemo<(Node & HostCommonDetails)[]>(
    () =>
      networkHosts.filter(
        (node) =>
          node.name?.toLowerCase().includes(egressSearch.toLowerCase()) ||
          node.address?.toLowerCase().includes(egressSearch.toLowerCase())
      ),
    [egressSearch, networkHosts]
  );
  const egressTableCols = useMemo<TableColumnProps<Node & HostCommonDetails>[]>(() => {
    return [
      {
        title: 'Host name',
        dataIndex: 'name',
        render(value) {
          return <Typography.Link>{value}</Typography.Link>;
        },
      },
      {
        title: 'Address',
        dataIndex: 'address',
        render(value, egress) {
          return <Typography.Text>{`${value}, ${egress.address6}`}</Typography.Text>;
        },
      },
      {
        title: 'Endpoint',
        dataIndex: 'endpointip',
      },
      {
        title: 'Health status',
        render(value, node) {
          return getNodeConnectivity(node);
        },
      },
    ];
  }, [getNodeConnectivity]);

  const createEgress = async () => {
    try {
      const formData = await form.validateFields();
      setIsSubmitting(true);

      if (!selectedEgress) return;
      await NodesService.createEgressNode(selectedEgress.id, networkId, {
        ...formData,
        natEnabled: formData.natEnabled ? 'yes' : 'no',
      });
      onCreateEgress();
      notify.success({ message: `Egress gateway created` });
    } catch (err) {
      if (err instanceof AxiosError) {
        notify.error({
          message: 'Failed to egress gateway',
          description: extractErrorMsg(err),
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // TODO: add autofill for fields
  return (
    <Modal
      title={<span style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Create an Egress</span>}
      open={isOpen}
      onCancel={onCancel}
      footer={null}
      className="CustomModal"
      style={{ minWidth: '50vw' }}
    >
      <Divider style={{ margin: '0px 0px 2rem 0px' }} />
      <Form name="add-egress-form" form={form} layout="vertical">
        <div className="" style={{ maxHeight: '60vh', overflow: 'auto' }}>
          <div className="CustomModalBody">
            <Form.Item
              label="Select host"
              name={idFormField}
              rules={[{ required: true }]}
              style={{ marginBottom: '0px' }}
            >
              {!selectedEgress && (
                <Select
                  placeholder="Select a host as gateway"
                  dropdownRender={() => (
                    <div style={{ padding: '.5rem' }}>
                      <Row style={{ marginBottom: '1rem' }}>
                        <Col span={8}>
                          <Input
                            placeholder="Search host"
                            value={egressSearch}
                            onChange={(e) => setEgressSearch(e.target.value)}
                          />
                        </Col>
                      </Row>
                      <Row>
                        <Col span={24}>
                          <Table
                            size="small"
                            columns={egressTableCols}
                            dataSource={filteredNetworkHosts}
                            rowKey="id"
                            onRow={(node) => {
                              return {
                                onClick: () => {
                                  form.setFieldValue(idFormField, node.id);
                                  setSelectedEgress(node);
                                },
                              };
                            }}
                          />
                        </Col>
                      </Row>
                    </div>
                  )}
                />
              )}
              {!!selectedEgress && (
                <>
                  <Row style={{ border: `1px solid ${themeToken.colorBorder}`, padding: '.5rem', borderRadius: '8px' }}>
                    <Col span={6}>{selectedEgress?.name ?? ''}</Col>
                    <Col span={6}>
                      {selectedEgress?.address ?? ''} {selectedEgress?.address6 ?? ''}
                    </Col>
                    <Col span={6}>{selectedEgress?.endpointip ?? ''}</Col>
                    <Col span={5}>{getNodeConnectivity(selectedEgress)}</Col>
                    <Col span={1} style={{ textAlign: 'right' }}>
                      <Button
                        danger
                        size="small"
                        type="text"
                        icon={<CloseOutlined />}
                        onClick={() => {
                          form.setFieldValue(idFormField, '');
                          setSelectedEgress(null);
                        }}
                      />
                    </Col>
                  </Row>
                </>
              )}
            </Form.Item>
          </div>

          <Divider style={{ margin: '0px 0px 2rem 0px' }} />
          <div className="CustomModalBody">
            <Form.Item name="natEnabled" label="Enable NAT for egress traffic" valuePropName="checked">
              <Switch />
            </Form.Item>

            <Typography.Title level={4}>Select external ranges</Typography.Title>

            <Form.List
              name="ranges"
              initialValue={['']}
              rules={[
                {
                  validator: async (_, ranges) => {
                    if (!ranges || ranges.length < 1) {
                      return Promise.reject(new Error('Enter at least one address range'));
                    }
                  },
                },
              ]}
            >
              {(fields, { add, remove }, { errors }) => (
                <>
                  {fields.map((field, index) => (
                    <Form.Item
                      label={index === 0 ? 'Input range' : ''}
                      key={field.key}
                      required={false}
                      style={{ marginBottom: '.5rem' }}
                    >
                      <Form.Item
                        {...field}
                        validateTrigger={['onBlur']}
                        rules={[
                          {
                            required: true,
                            validator(_, value) {
                              if (!isValidIp(value)) {
                                return Promise.reject('Invalid CIDR');
                              } else {
                                return Promise.resolve();
                              }
                            },
                          },
                        ]}
                        noStyle
                      >
                        <Input
                          placeholder="CIDR range (eg: 10.0.0.0/8 or a123:4567::/16)"
                          style={{ width: '100%' }}
                          suffix={
                            <Tooltip title="Remove">
                              <CloseOutlined onClick={() => remove(index)} />
                            </Tooltip>
                          }
                        />
                      </Form.Item>
                    </Form.Item>
                  ))}
                  <Form.Item>
                    <Button onClick={() => add()} icon={<PlusOutlined />}>
                      Add range
                    </Button>
                    <Form.ErrorList errors={errors} />
                  </Form.Item>
                </>
              )}
            </Form.List>
          </div>
        </div>
        <Divider style={{ margin: '0px 0px 2rem 0px' }} />
        <div className="CustomModalBody">
          <Row>
            <Col xs={24} style={{ textAlign: 'right' }}>
              <Button type="primary" onClick={createEgress} loading={isSubmitting}>
                Create Egress
              </Button>
            </Col>
          </Row>
        </div>
      </Form>

      {/* misc */}
      {notifyCtx}
    </Modal>
  );
}
