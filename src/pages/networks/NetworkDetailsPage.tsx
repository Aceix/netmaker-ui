import AddClientModal from '@/components/modals/add-client-modal/AddClientModal';
import AddDnsModal from '@/components/modals/add-dns-modal/AddDnsModal';
import AddEgressModal from '@/components/modals/add-egress-modal/AddEgressModal';
import ClientDetailsModal from '@/components/modals/client-detaiils-modal/ClientDetailsModal';
import { NodeACLContainer } from '@/models/Acl';
import { DNS } from '@/models/Dns';
import { ExternalClient } from '@/models/ExternalClient';
import { HostCommonDetails } from '@/models/Host';
import { Network } from '@/models/Network';
import { ExtendedNode, Node } from '@/models/Node';
import { AppRoutes } from '@/routes';
import { NetworksService } from '@/services/NetworksService';
import { NodesService } from '@/services/NodesService';
import { useStore } from '@/store/store';
import { convertUiNetworkToNetworkModel, isNetworkIpv4, isNetworkIpv6 } from '@/utils/NetworkUtils';
import { getExtendedNode } from '@/utils/NodeUtils';
import { getHostRoute } from '@/utils/RouteUtils';
import { extractErrorMsg } from '@/utils/ServiceUtils';
import { DeleteOutlined, ExclamationCircleFilled, MoreOutlined, PlusOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Col,
  Dropdown,
  Form,
  Input,
  Layout,
  MenuProps,
  Modal,
  notification,
  Row,
  Select,
  Skeleton,
  Switch,
  Table,
  TableColumnProps,
  Tabs,
  TabsProps,
  theme,
  Tooltip,
  Typography,
} from 'antd';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageProps } from '../../models/Page';

import './NetworkDetailsPage.scss';

interface ExternalRoutesTableData {
  hostName: HostCommonDetails['name'];
  range: Node['egressgatewayranges'][0];
}

export default function NetworkDetailsPage(props: PageProps) {
  const { networkId } = useParams<{ networkId: string }>();
  const store = useStore();
  const navigate = useNavigate();
  const [notify, notifyCtx] = notification.useNotification();
  const { token: themeToken } = theme.useToken();

  const [form] = Form.useForm<Network>();
  const isIpv4Watch = Form.useWatch('isipv4', form);
  const isIpv6Watch = Form.useWatch('isipv6', form);
  const [network, setNetwork] = useState<Network | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [searchHost, setSearchHost] = useState('');
  const [searchDns, setSearchDns] = useState('');
  const [dnses, setDnses] = useState<DNS[]>([]);
  const [isAddDnsModalOpen, setIsAddDnsModalOpen] = useState(false);
  const [acls, setAcls] = useState<NodeACLContainer>({});
  const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);
  const [clients, setClients] = useState<ExternalClient[]>([]);
  const [isClientDetailsModalOpen, setIsClientDetailsModalOpen] = useState(false);
  const [targetClient, setTargetClient] = useState<ExternalClient | null>(null);
  const [filteredGateway, setFilteredGateway] = useState<Node | null>(null);
  const [filteredEgress, setFilteredEgress] = useState<Node | null>(null);
  const [isAddEgressModalOpen, setIsAddEgressModalOpen] = useState(false);

  const networkHosts = useMemo(
    () =>
      store.nodes
        .filter((node) => node.network === networkId)
        // TODO: add name search
        .filter((node) => node.address.toLowerCase().includes(searchHost.toLowerCase())),
    [store.nodes, networkId, searchHost]
  );

  const clientGateways = useMemo<ExtendedNode[]>(() => {
    return networkHosts
      .filter((node) => node.isingressgateway)
      .map((node) => getExtendedNode(node, store.hostsCommonDetails));
  }, [networkHosts, store.hostsCommonDetails]);

  const filteredClients = useMemo<ExternalClient[]>(
    () =>
      clients.filter((client) => {
        if (filteredGateway) {
          return client.ingressgatewayid === filteredGateway.id;
        }
        return true;
      }),
    [clients, filteredGateway]
  );

  const egress = useMemo<ExtendedNode[]>(() => {
    return networkHosts
      .filter((node) => node.isegressgateway)
      .map((node) => getExtendedNode(node, store.hostsCommonDetails));
  }, [networkHosts, store.hostsCommonDetails]);

  const filteredExternalRoutes = useMemo<ExternalRoutesTableData[]>(() => {
    if (filteredEgress) {
      return filteredEgress.egressgatewayranges.map((range) => ({
        hostName: getExtendedNode(filteredEgress, store.hostsCommonDetails).name ?? '',
        range,
      }));
    } else {
      return egress.flatMap((e) => e.egressgatewayranges.map((range) => ({ hostName: e.name ?? '', range })));
    }
  }, [egress, filteredEgress, store.hostsCommonDetails]);

  const confirmDeleteClient = useCallback(
    (client: ExternalClient) => {
      Modal.confirm({
        title: `Delete client ${client.clientid}`,
        content: `Are you sure you want to delete this client?`,
        onOk: async () => {
          try {
            await NodesService.deleteExternalClient(client.clientid, client.network);
            setClients((prev) => prev.filter((c) => c.clientid !== client.clientid));
            store.fetchNodes();
          } catch (err) {
            if (err instanceof AxiosError) {
              notify.error({
                message: 'Error deleting Client',
                description: extractErrorMsg(err),
              });
            }
          }
        },
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [notify]
  );

  const openClientDetails = useCallback((client: ExternalClient) => {
    setTargetClient(client);
    setIsClientDetailsModalOpen(true);
  }, []);

  const confirmDeleteGateway = useCallback(
    (gateway: Node) => {
      Modal.confirm({
        title: `Delete gateway ${getExtendedNode(gateway, store.hostsCommonDetails).name}`,
        content: `Are you sure you want to delete this gateway?`,
        onOk: async () => {
          try {
            await NodesService.deleteIngressNode(gateway.id, gateway.network);
            store.fetchNodes();
          } catch (err) {
            if (err instanceof AxiosError) {
              notify.error({
                message: 'Error deleting gateway',
                description: extractErrorMsg(err),
              });
            }
          }
        },
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [notify]
  );

  const confirmDeleteEgress = useCallback(
    (egress: Node) => {
      Modal.confirm({
        title: `Delete egress ${getExtendedNode(egress, store.hostsCommonDetails).name}`,
        content: `Are you sure you want to delete this egress?`,
        onOk: async () => {
          try {
            await NodesService.deleteEgressNode(egress.id, egress.network);
            store.fetchNodes();
          } catch (err) {
            if (err instanceof AxiosError) {
              notify.error({
                message: 'Error deleting egress',
                description: extractErrorMsg(err),
              });
            }
          }
        },
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [notify]
  );

  const confirmDeleteRange = useCallback((range: ExternalRoutesTableData) => {}, []);

  const gatewaysTableCols = useMemo<TableColumnProps<ExtendedNode>[]>(
    () => [
      {
        title: 'Host name',
        dataIndex: 'name',
        width: 500,
        render(name) {
          return <Typography.Link>{name}</Typography.Link>;
        },
      },
      {
        title: 'Addresses',
        dataIndex: 'address',
        render(_, node) {
          const addrs = `${node.address}, ${node.address6}`;
          return <Tooltip title={addrs}>{addrs}</Tooltip>;
        },
      },
      {
        title: 'Endpoint',
        dataIndex: 'endpointip',
      },
      {
        render(_, gateway) {
          return (
            <Dropdown
              placement="bottomRight"
              menu={{
                items: [
                  {
                    key: 'delete',
                    label: (
                      <Typography.Text onClick={() => confirmDeleteGateway(gateway)}>
                        <DeleteOutlined /> Delete
                      </Typography.Text>
                    ),
                  },
                ] as MenuProps['items'],
              }}
            >
              <Button type="text" icon={<MoreOutlined />} />
            </Dropdown>
          );
        },
      },
    ],
    [confirmDeleteGateway]
  );

  const egressTableCols = useMemo<TableColumnProps<ExtendedNode>[]>(
    () => [
      {
        title: 'Host name',
        dataIndex: 'name',
        width: 500,
        render(name) {
          return <Typography.Link>{name}</Typography.Link>;
        },
      },
      {
        title: 'Addresses',
        dataIndex: 'address',
        render(_, node) {
          const addrs = `${node.address}, ${node.address6}`;
          return <Tooltip title={addrs}>{addrs}</Tooltip>;
        },
      },
      {
        title: 'Endpoint',
        dataIndex: 'endpointip',
      },
      {
        width: '1rem',
        render(_, egress) {
          return (
            <Dropdown
              placement="bottomRight"
              menu={{
                items: [
                  {
                    key: 'delete',
                    label: (
                      <Typography.Text onClick={() => confirmDeleteEgress(egress)}>
                        <DeleteOutlined /> Delete
                      </Typography.Text>
                    ),
                  },
                ] as MenuProps['items'],
              }}
            >
              <Button type="text" icon={<MoreOutlined />} />
            </Dropdown>
          );
        },
      },
    ],
    [confirmDeleteEgress]
  );

  const externalRoutesTableCols = useMemo<TableColumnProps<ExternalRoutesTableData>[]>(() => {
    return [
      {
        title: 'CIDR',
        dataIndex: 'range',
      },
      {
        title: 'Host',
        dataIndex: 'hostName',
      },
      {
        width: '1rem',
        render(_, range) {
          return (
            <Dropdown
              placement="bottomRight"
              menu={{
                items: [
                  {
                    key: 'delete',
                    label: (
                      <Typography.Text onClick={() => confirmDeleteRange(range)}>
                        <DeleteOutlined /> Delete
                      </Typography.Text>
                    ),
                  },
                ] as MenuProps['items'],
              }}
            >
              <Button type="text" icon={<MoreOutlined />} />
            </Dropdown>
          );
        },
      },
    ];
  }, [confirmDeleteRange]);

  const clientsTableCols = useMemo<TableColumnProps<ExternalClient>[]>(
    () => [
      {
        title: 'Client ID',
        dataIndex: 'clientid',
        width: 500,
        render(value, client) {
          return <Typography.Link onClick={() => openClientDetails(client)}>{value}</Typography.Link>;
        },
      },
      {
        title: 'Allowed IPs',
        // dataIndex: 'address',
        render(_, client) {
          const addrs = `${client.address}, ${client.address6}`;
          return <Tooltip title={addrs}>{addrs}</Tooltip>;
        },
      },
      {
        title: 'Public Key',
        dataIndex: 'publickey',
        width: 200,
        render(value) {
          return (
            <div style={{ width: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {value}
            </div>
          );
        },
      },
      {
        title: 'Status',
        dataIndex: 'enabled',
        render(value) {
          return (
            <Switch
              checked={value}
              // onChange={(checked) => {
              //   const newClients = [...clients];
              //   newClients[index].enabled = checked;
              //   setClients(newClients);
              // }}
            />
          );
        },
      },
      {
        render(_, client) {
          return (
            <Dropdown
              placement="bottomRight"
              menu={{
                items: [
                  {
                    key: 'delete',
                    label: (
                      <Tooltip title="Cannot delete default DNS">
                        <Typography.Text onClick={() => confirmDeleteClient(client)}>
                          <DeleteOutlined /> Delete
                        </Typography.Text>
                      </Tooltip>
                    ),
                  },
                ] as MenuProps['items'],
              }}
            >
              <Button type="text" icon={<MoreOutlined />} />
            </Dropdown>
          );
        },
      },
    ],
    [confirmDeleteClient, openClientDetails]
  );

  const goToNewHostPage = useCallback(() => {
    navigate(AppRoutes.NEW_HOST_ROUTE);
  }, [navigate]);

  const confirmDeleteDns = useCallback(
    (dns: DNS) => {
      Modal.confirm({
        title: `Delete DNS ${dns.name}.${dns.network}`,
        content: `Are you sure you want to delete this DNS?`,
        onOk: async () => {
          try {
            await NetworksService.deleteDns(dns.network, dns.name);
            setDnses((dnses) => dnses.filter((dns) => dns.name !== dns.name));
          } catch (err) {
            if (err instanceof AxiosError) {
              notify.error({
                message: 'Error deleting DNS',
                description: extractErrorMsg(err),
              });
            }
          }
        },
      });
    },
    [notify]
  );

  // ui components
  const getOverviewContent = useCallback(
    (network: Network) => {
      return (
        <div className="" style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
          <Card style={{ width: '50%' }}>
            <Form name="add-network-form" form={form} layout="vertical" initialValues={network} disabled={!isEditing}>
              <Form.Item label="Network name" name="netid" rules={[{ required: true }]}>
                <Input placeholder="Network name" />
              </Form.Item>

              {/* ipv4 */}
              <Row
                style={{
                  border: `1px solid ${themeToken.colorBorder}`,
                  borderRadius: '8px',
                  padding: '.5rem',
                  marginBottom: '1.5rem',
                }}
              >
                <Col xs={24}>
                  <Row justify="space-between" style={{ marginBottom: isIpv4Watch ? '.5rem' : '0px' }}>
                    <Col>IPv4</Col>
                    <Col>
                      <Form.Item name="isipv4" style={{ marginBottom: '0px' }}>
                        <Switch defaultChecked={isNetworkIpv4(form.getFieldsValue())} />
                      </Form.Item>
                    </Col>
                  </Row>
                  {isIpv4Watch && (
                    <Row>
                      <Col xs={24}>
                        <Form.Item name="addressrange" style={{ marginBottom: '0px' }}>
                          <Input placeholder="Enter address CIDR (eg: 192.168.1.0/24)" />
                        </Form.Item>
                      </Col>
                    </Row>
                  )}
                </Col>
              </Row>

              {/* ipv6 */}
              <Row
                style={{
                  border: `1px solid ${themeToken.colorBorder}`,
                  borderRadius: '8px',
                  padding: '.5rem',
                  marginBottom: '1.5rem',
                }}
              >
                <Col xs={24}>
                  <Row justify="space-between" style={{ marginBottom: isIpv6Watch ? '.5rem' : '0px' }}>
                    <Col>IPv6</Col>
                    <Col>
                      <Form.Item name="isipv6" style={{ marginBottom: '0px' }}>
                        <Switch defaultChecked={isNetworkIpv6(form.getFieldsValue())} />
                      </Form.Item>
                    </Col>
                  </Row>
                  {isIpv6Watch && (
                    <Row>
                      <Col xs={24}>
                        <Form.Item name="addressrange6" style={{ marginBottom: '0px' }}>
                          <Input placeholder="Enter address CIDR (eg: 2002::1234:abcd:ffff:c0a8:101/64)" />
                        </Form.Item>
                      </Col>
                    </Row>
                  )}
                </Col>
              </Row>

              <Row
                style={{
                  border: `1px solid ${themeToken.colorBorder}`,
                  borderRadius: '8px',
                  padding: '.5rem',
                  marginBottom: '1.5rem',
                }}
              >
                <Col xs={24}>
                  <Row justify="space-between">
                    <Col>Default Access Control</Col>
                    <Col xs={8}>
                      <Form.Item name="defaultacl" style={{ marginBottom: '0px' }} rules={[{ required: true }]}>
                        <Select
                          size="small"
                          style={{ width: '100%' }}
                          options={[
                            { label: 'ALLOW', value: 'yes' },
                            { label: 'DENY', value: 'no' },
                          ]}
                        ></Select>
                      </Form.Item>
                    </Col>
                  </Row>
                </Col>
              </Row>

              <Form.Item label="Default Client DNS" name="defaultDns">
                <Input placeholder="Default Client DNS" />
              </Form.Item>
            </Form>
          </Card>
        </div>
      );
    },
    [form, isEditing, themeToken, isIpv4Watch, isIpv6Watch]
  );

  const getHostsContent = useCallback(
    (network: Network) => {
      return (
        <div className="" style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
          <Card style={{ width: '100%' }}>
            <Row justify="space-between" style={{ marginBottom: '1rem' }}>
              <Col xs={12} md={8}>
                <Input
                  size="large"
                  placeholder="Search hosts"
                  value={searchHost}
                  onChange={(ev) => setSearchHost(ev.target.value)}
                />
              </Col>
              <Col xs={12} md={6} style={{ textAlign: 'right' }}>
                <Button type="primary" size="large" onClick={goToNewHostPage}>
                  <PlusOutlined /> Add Host
                </Button>
              </Col>
            </Row>

            <Table
              columns={[
                {
                  title: 'Host Name',
                  render: (_, node) => {
                    const hostName = store.hostsCommonDetails[node.hostid].name;
                    // TODO: fix broken link
                    return <Link to={getHostRoute(hostName)}>{hostName}</Link>;
                  },
                },
                {
                  title: 'Private Address',
                  dataIndex: 'address',
                  render: (address: string, node) => (
                    <>
                      <Typography.Text copyable>{address}</Typography.Text>
                      <Typography.Text copyable={!!node.address6}>{node.address6}</Typography.Text>
                    </>
                  ),
                },
                {
                  title: 'Public Address',
                  dataIndex: 'name',
                },
                {
                  title: 'Preferred DNS',
                  dataIndex: 'name',
                },
                {
                  title: 'Health Status',
                  dataIndex: 'name',
                },
                {
                  title: 'Connection status',
                  // dataIndex: 'name',
                },
              ]}
              dataSource={networkHosts}
              rowKey="id"
            />
          </Card>
        </div>
      );
    },
    [goToNewHostPage, networkHosts, searchHost, store.hostsCommonDetails]
  );

  const getDnsContent = useCallback(
    (network: Network) => {
      return (
        <div className="" style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
          <Card style={{ width: '100%' }}>
            <Row justify="space-between" style={{ marginBottom: '1rem' }}>
              <Col xs={12} md={8}>
                <Input
                  size="large"
                  placeholder="Search DNS"
                  value={searchDns}
                  onChange={(ev) => setSearchDns(ev.target.value)}
                />
              </Col>
              <Col xs={12} md={6} style={{ textAlign: 'right' }}>
                <Button type="primary" size="large" onClick={() => setIsAddDnsModalOpen(true)}>
                  <PlusOutlined /> Add DNS
                </Button>
              </Col>
            </Row>

            <Table
              columns={[
                {
                  title: 'DNS Entry',
                  render(_, dns) {
                    return <Typography.Text copyable>{`${dns.name}.${dns.network}`}</Typography.Text>;
                  },
                },
                {
                  title: 'IP Addresses',
                  render(_, dns) {
                    return (
                      <Typography.Text copyable>
                        {dns.address}
                        {dns.address6 && `, ${dns.address6}`}
                      </Typography.Text>
                    );
                  },
                },
                {
                  title: '',
                  key: 'action',
                  width: '1rem',
                  render: (_, dns) => (
                    <Dropdown
                      placement="bottomRight"
                      menu={{
                        items: [
                          {
                            key: 'delete',
                            label: (
                              <Tooltip title="Cannot delete default DNS">
                                <Typography.Text onClick={() => confirmDeleteDns(dns)}>
                                  <DeleteOutlined /> Delete
                                </Typography.Text>
                              </Tooltip>
                            ),
                          },
                        ] as MenuProps['items'],
                      }}
                    >
                      <MoreOutlined />
                    </Dropdown>
                  ),
                },
              ]}
              dataSource={dnses}
              rowKey="name"
            />
          </Card>
        </div>
      );
    },
    [confirmDeleteDns, dnses, searchDns]
  );

  const getClientsContent = useCallback(
    (network: Network) => {
      return (
        <div className="" style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
          {clients.length === 0 && (
            <Row
              className="page-padding"
              style={{
                background: 'linear-gradient(90deg, #52379F 0%, #B66666 100%)',
                width: '100%',
              }}
            >
              <Col xs={(24 * 2) / 3}>
                <Typography.Title level={3} style={{ color: 'white ' }}>
                  Clients
                </Typography.Title>
                <Typography.Text style={{ color: 'white ' }}>
                  Lorem ipsum dolor sit amet consectetur adipisicing elit. Cumque amet modi cum aut doloremque dicta
                  reiciendis odit molestias nam animi enim et molestiae consequatur quas quo facere magni, maiores rem.
                </Typography.Text>
              </Col>
              <Col xs={(24 * 1) / 3} style={{ position: 'relative' }}>
                <Card className="header-card" style={{ position: 'absolute', width: '100%' }}>
                  <Typography.Title level={3}>Create Client</Typography.Title>
                  <Typography.Text>
                    Enable remote access to your network with clients. Clients enable you to connect mobile and other
                    devices to your networks.
                  </Typography.Text>
                  {clientGateways.length === 0 && (
                    <Alert
                      type="warning"
                      showIcon
                      message="No Client Gateway"
                      description="You will be prompted to create a gateway for your network when creating a client."
                      style={{ marginTop: '1rem' }}
                    />
                  )}
                  <Row style={{ marginTop: '1rem' }}>
                    <Col>
                      <Button type="primary" size="large" onClick={() => setIsAddClientModalOpen(true)}>
                        <PlusOutlined /> Create Client
                      </Button>
                    </Col>
                  </Row>
                </Card>
              </Col>
            </Row>
          )}

          {clients.length > 0 && (
            <Row style={{ width: '100%' }}>
              <Col xs={12}>
                <Row style={{ width: '100%' }}>
                  <Col xs={12}>
                    <Typography.Title style={{ marginTop: '0px' }} level={5}>
                      Gateways
                    </Typography.Title>
                  </Col>
                  <Col xs={11} style={{ textAlign: 'right' }}>
                    <Button type="primary" onClick={() => setIsAddClientModalOpen(true)}>
                      <PlusOutlined /> Create Client
                    </Button>
                  </Col>
                </Row>
                <Row style={{ marginTop: '1rem' }}>
                  <Col xs={23}>
                    <Table
                      columns={gatewaysTableCols}
                      dataSource={clientGateways}
                      rowKey="id"
                      size="small"
                      rowClassName={(gateway) => {
                        return gateway.id === filteredGateway?.id ? 'selected-row' : '';
                      }}
                      onRow={(gateway) => {
                        return {
                          onClick: () => {
                            if (filteredGateway?.id === gateway.id) setFilteredGateway(null);
                            else setFilteredGateway(gateway);
                          },
                        };
                      }}
                    />
                  </Col>
                </Row>
              </Col>
              <Col xs={12}>
                <Row style={{ width: '100%' }}>
                  <Col xs={12}>
                    <Typography.Title style={{ marginTop: '0px' }} level={5}>
                      Clients
                    </Typography.Title>
                  </Col>
                  <Col xs={12} style={{ textAlign: 'right' }}>
                    Display All{' '}
                    <Switch
                      title="Display all clients. Click a gateway to filter clients specific to that gateway."
                      checked={filteredGateway === null}
                      onClick={() => {
                        setFilteredGateway(null);
                      }}
                    />
                  </Col>
                </Row>
                <Row style={{ marginTop: '1rem' }}>
                  <Col xs={24}>
                    <Table columns={clientsTableCols} dataSource={filteredClients} rowKey="clientid" size="small" />
                  </Col>
                </Row>
              </Col>
            </Row>
          )}
        </div>
      );
    },
    [clientGateways, clients, clientsTableCols, filteredClients, filteredGateway, gatewaysTableCols]
  );

  const getEgressContent = useCallback(
    (network: Network) => {
      return (
        <div className="" style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
          {egress.length === 0 && (
            <Row
              className="page-padding"
              style={{
                background: 'linear-gradient(90deg, #52379F 0%, #B66666 100%)',
                width: '100%',
              }}
            >
              <Col xs={16}>
                <Typography.Title level={3} style={{ color: 'white ' }}>
                  Egress
                </Typography.Title>
                <Typography.Text style={{ color: 'white ' }}>
                  Enable devices in your network to communicate with other devices outside the network via egress
                  gateways.
                </Typography.Text>
              </Col>
              <Col xs={8} style={{ position: 'relative' }}>
                <Card className="header-card" style={{ position: 'absolute', width: '100%' }}>
                  <Typography.Title level={3}>Create Egress</Typography.Title>
                  <Typography.Text>
                    Enable devices in your network to communicate with other devices outside the network via egress
                    gateways.
                  </Typography.Text>
                  <Row style={{ marginTop: '5rem' }}>
                    <Col>
                      <Button type="primary" size="large" onClick={() => setIsAddEgressModalOpen(true)}>
                        <PlusOutlined /> Create Egress
                      </Button>
                    </Col>
                  </Row>
                </Card>
              </Col>
            </Row>
          )}

          {egress.length > 0 && (
            <Row style={{ width: '100%' }}>
              <Col xs={12}>
                <Row style={{ width: '100%' }}>
                  <Col xs={12}>
                    <Typography.Title style={{ marginTop: '0px' }} level={5}>
                      Egress Gateways
                    </Typography.Title>
                  </Col>
                  <Col xs={11} style={{ textAlign: 'right' }}>
                    <Button type="primary" onClick={() => setIsAddEgressModalOpen(true)}>
                      <PlusOutlined /> Create Egress
                    </Button>
                  </Col>
                </Row>
                <Row style={{ marginTop: '1rem' }}>
                  <Col xs={23}>
                    <Table
                      columns={egressTableCols}
                      dataSource={egress}
                      rowKey="id"
                      size="small"
                      rowClassName={(egress) => {
                        return egress.id === filteredEgress?.id ? 'selected-row' : '';
                      }}
                      onRow={(egress) => {
                        return {
                          onClick: () => {
                            if (filteredEgress?.id === egress.id) setFilteredEgress(null);
                            else setFilteredEgress(egress);
                          },
                        };
                      }}
                    />
                  </Col>
                </Row>
              </Col>
              <Col xs={12}>
                <Row style={{ width: '100%' }}>
                  <Col xs={12}>
                    <Typography.Title style={{ marginTop: '0px' }} level={5}>
                      External routes
                    </Typography.Title>
                  </Col>
                  <Col xs={12} style={{ textAlign: 'right' }}>
                    {filteredEgress && (
                      <Button
                        type="primary"
                        style={{ marginRight: '1rem' }}
                        // onClick={() => setIsAddEgressModalOpen(true)}
                      >
                        <PlusOutlined /> Add external route
                      </Button>
                    )}
                    Display All{' '}
                    <Switch
                      title="Display all routes. Click an egress to filter routes specific to that egress."
                      checked={filteredEgress === null}
                      onClick={() => {
                        setFilteredEgress(null);
                      }}
                    />
                  </Col>
                </Row>
                <Row style={{ marginTop: '1rem' }}>
                  <Col xs={24}>
                    <Table
                      columns={externalRoutesTableCols}
                      dataSource={filteredExternalRoutes}
                      rowKey="clientid"
                      size="small"
                    />
                  </Col>
                </Row>
              </Col>
            </Row>
          )}
        </div>
      );
    },
    [egress, egressTableCols, externalRoutesTableCols, filteredEgress, filteredExternalRoutes]
  );

  const getAclsContent = useCallback((network: Network) => {
    return (
      <div className="" style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
        <Card style={{ width: '100%' }}></Card>
      </div>
    );
  }, []);

  const items: TabsProps['items'] = useMemo(
    () => [
      {
        key: 'overview',
        label: `Overview`,
        children: network ? getOverviewContent(network) : <Skeleton active />,
      },
      {
        key: 'hosts',
        label: `Hosts (#)`,
        children: network ? getHostsContent(network) : <Skeleton active />,
      },
      {
        key: 'graph',
        label: `Graph`,
        children: `Content of Graph Tab`,
      },
      {
        key: 'acls',
        label: `ACLs`,
        children: network ? getAclsContent(network) : <Skeleton active />,
      },
      {
        key: 'clients',
        label: `Clients`,
        children: network ? getClientsContent(network) : <Skeleton active />,
      },
      {
        key: 'egress',
        label: `Egress`,
        children: network ? getEgressContent(network) : <Skeleton active />,
      },
      {
        key: 'relays',
        label: `Relays `,
        children: 'Content of Relays Tab',
      },
      {
        key: 'dns',
        label: `DNS`,
        children: network ? getDnsContent(network) : <Skeleton active />,
      },
      {
        key: 'access-control',
        label: `Access Control`,
        children: 'Content of Access Control Tab',
      },
      {
        key: 'metrics',
        label: `Metrics`,
        children: 'Content of Metrics Tab',
      },
    ],
    [network, getOverviewContent, getHostsContent, getAclsContent, getClientsContent, getEgressContent, getDnsContent]
  );

  const loadClients = useCallback(async () => {
    try {
      if (!networkId) return;
      const allClients = (await NodesService.getExternalClients()).data;
      const networkClients = allClients.filter((client) => client.network === networkId);
      setClients(networkClients);
    } catch (err) {
      if (err instanceof AxiosError) {
        notify.error({
          message: 'Error loading clients',
          description: extractErrorMsg(err),
        });
      }
    }
  }, [networkId, notify]);

  const loadDnses = useCallback(async () => {
    try {
      if (!networkId) return;
      const dnses = (await NetworksService.getDnses()).data;
      const networkDnses = dnses.filter((dns) => dns.network === networkId);
      setDnses(networkDnses);
    } catch (err) {
      if (err instanceof AxiosError) {
        notify.error({
          message: 'Error loading DNSes',
          description: extractErrorMsg(err),
        });
      }
    }
  }, [networkId, notify]);

  const loadAcls = useCallback(async () => {
    try {
      if (!networkId) return;
      const acls = (await NetworksService.getAcls(networkId)).data;
      setAcls(acls);
    } catch (err) {
      if (err instanceof AxiosError) {
        notify.error({
          message: 'Error loading ACLs',
          description: extractErrorMsg(err),
        });
      }
    }
  }, [networkId, notify]);

  const loadNetwork = useCallback(() => {
    // TODO: remove
    store.fetchNodes();
    store.fetchHosts();

    setIsLoading(true);
    // route to networks if id is not present
    if (!networkId) {
      navigate(AppRoutes.NETWORKS_ROUTE);
    }
    // load from store
    const network = store.networks.find((network) => network.netid === networkId);
    if (!network) {
      notify.error({ message: `Network ${networkId} not found` });
      navigate(AppRoutes.NETWORKS_ROUTE);
      return;
    }
    setNetwork(network);

    // load extra data
    loadDnses();
    loadAcls();
    loadClients();

    setIsLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, networkId, notify, store.networks, loadDnses]);

  const onNetworkFormEdit = useCallback(async () => {
    try {
      const formData = await form.validateFields();
      if (!networkId) {
        throw new Error('Network not found');
      }
      const network = (await NetworksService.updateNetwork(networkId, convertUiNetworkToNetworkModel(formData))).data;
      store.updateNetwork(networkId, network);
    } catch (err) {
      if (err instanceof AxiosError) {
        notify.error({
          message: 'Failed to save changes',
          description: extractErrorMsg(err),
        });
      } else {
        notify.error({
          message: err instanceof Error ? err.message : 'Failed to save changes',
        });
      }
    }
  }, [form, networkId, notify, store]);

  const onNetworkDelete = useCallback(async () => {
    try {
      if (!networkId) {
        throw new Error('Network not found');
      }
      await NetworksService.deleteNetwork(networkId);
      store.deleteNetwork(networkId);
      navigate(AppRoutes.NETWORKS_ROUTE);
    } catch (err) {
      if (err instanceof AxiosError) {
        notify.error({
          message: 'Failed to delete network',
          description: extractErrorMsg(err),
        });
      } else {
        notify.error({
          message: err instanceof Error ? err.message : 'Failed to delete network',
        });
      }
    }
  }, [networkId, notify, navigate, store]);

  const onCreateDns = useCallback((dns: DNS) => {
    setDnses((prevDnses) => [...prevDnses, dns]);
    setIsAddDnsModalOpen(false);
  }, []);

  const promptConfirmDelete = () => {
    Modal.confirm({
      title: `Do you want to delete network ${network?.netid}?`,
      icon: <ExclamationCircleFilled />,
      onOk() {
        onNetworkDelete();
      },
    });
  };

  useEffect(() => {
    loadNetwork();
  }, [loadNetwork]);

  if (!networkId) {
    navigate(AppRoutes.NETWORKS_ROUTE);
    return null;
  }

  return (
    <Layout.Content
      className="NetworkDetailsPage"
      style={{ position: 'relative', height: '100%', padding: props.isFullScreen ? 0 : 24 }}
    >
      <Skeleton loading={isLoading} active className="page-padding">
        {/* top bar */}
        <Row className="tabbed-page-row-padding">
          <Col xs={24}>
            <Link to={AppRoutes.NETWORKS_ROUTE}>View All Networks</Link>
            <Row>
              <Col xs={18}>
                <Typography.Title level={2} copyable style={{ marginTop: '.5rem', marginBottom: '2rem' }}>
                  {network?.netid}
                </Typography.Title>
              </Col>
              <Col xs={6} style={{ textAlign: 'right' }}>
                {!isEditing && (
                  <Button type="default" style={{ marginRight: '.5rem' }} onClick={() => setIsEditing(true)}>
                    Edit
                  </Button>
                )}
                {isEditing && (
                  <Button type="primary" style={{ marginRight: '.5rem' }} onClick={onNetworkFormEdit}>
                    Save Changes
                  </Button>
                )}
                <Button type="default" onClick={promptConfirmDelete}>
                  Delete
                </Button>
              </Col>
            </Row>

            <Tabs items={items} />
          </Col>
        </Row>
      </Skeleton>

      {/* misc */}
      {notifyCtx}
      <AddDnsModal
        isOpen={isAddDnsModalOpen}
        networkId={networkId}
        onCreateDns={onCreateDns}
        onCancel={() => setIsAddDnsModalOpen(false)}
      />
      <AddClientModal
        isOpen={isAddClientModalOpen}
        networkId={networkId}
        onCreateClient={() => {
          loadClients();
          store.fetchNodes();
        }}
        onCancel={() => setIsAddClientModalOpen(false)}
      />
      <AddEgressModal
        isOpen={isAddEgressModalOpen}
        networkId={networkId}
        onCreateEgress={() => {
          store.fetchNodes();
          setIsAddEgressModalOpen(false);
        }}
        onCancel={() => setIsAddEgressModalOpen(false)}
      />
      {targetClient && (
        <ClientDetailsModal
          isOpen={isClientDetailsModalOpen}
          client={targetClient}
          // onDeleteClient={() => {
          //   loadClients();
          // }}
          onCancel={() => setIsClientDetailsModalOpen(false)}
        />
      )}
    </Layout.Content>
  );
}
