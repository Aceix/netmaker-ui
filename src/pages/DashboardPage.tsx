import { Alert, Button, Card, Col, Dropdown, Input, Layout, Row, Space, Tooltip, Typography } from 'antd';
import {
  ArrowRightOutlined,
  DownOutlined,
  GlobalOutlined,
  LaptopOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import UpgradeModal from '../components/modals/upgrade-modal/UpgradeModal';
import { PageProps } from '../models/Page';
import { AppRoutes } from '../routes';
import { useNavigate } from 'react-router-dom';
import AddNetworkModal from '@/components/modals/add-network-modal/AddNetworkModal';
import { useState } from 'react';
import { useStore } from '@/store/store';
import { getAmuiUrl, getLicenseDashboardUrl } from '@/utils/RouteUtils';
import NewHostModal from '@/components/modals/new-host-modal/NewHostModal';
import { getBrandingConfig, isSaasBuild } from '@/services/BaseService';

export default function DashboardPage(props: PageProps) {
  const navigate = useNavigate();
  const store = useStore();

  const isServerEE = store.serverConfig?.IsEE === 'yes';
  const [isAddNetworkModalOpen, setIsAddNetworkModalOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isNewHostModalOpen, setIsNewHostModalOpen] = useState(false);

  return (
    <Layout.Content style={{ padding: props.isFullScreen ? 0 : 24 }}>
      <Row>
        <Layout.Header style={{ width: '100%', padding: '0px', backgroundColor: 'transparent' }}>
          <Row>
            <Col xs={12}>
              {!isServerEE && (
                <Alert
                  message="You are on the free plan"
                  type="warning"
                  action={
                    <Button
                      type="link"
                      onClick={() => {
                        window.location = isSaasBuild
                          ? (getAmuiUrl('upgrade') as any)
                          : (getLicenseDashboardUrl() as any);
                        // setIsUpgradeModalOpen(true);
                      }}
                    >
                      <span style={{ textDecoration: 'underline', color: '#D4B106' }}>Upgrade now</span>
                    </Button>
                  }
                  style={{ width: '75%' }}
                />
              )}
            </Col>
            {/* <Col xs={6}></Col> */}
            <Col xs={12} style={{ textAlign: 'right' }}>
              <Space direction="horizontal" size="large" align="end">
                <Input
                  placeholder="Search..."
                  suffix={<SearchOutlined />}
                  style={{ borderRadius: '24px', width: '20rem' }}
                />
                <Dropdown.Button
                  style={{ marginTop: '-3rem', height: '100%' }}
                  type="primary"
                  menu={{
                    items: [
                      {
                        key: 'host',
                        label: (
                          <>
                            <LaptopOutlined /> <Typography.Text>Connect new Host</Typography.Text>
                          </>
                        ),
                        onClick: () => {
                          // navigate(getNewHostRoute(AppRoutes.HOSTS_ROUTE));
                          setIsNewHostModalOpen(true);
                        },
                      },
                    ],
                  }}
                  placement="bottomRight"
                  icon={<DownOutlined />}
                  onClick={() => setIsAddNetworkModalOpen(true)}
                >
                  <GlobalOutlined /> Create
                </Dropdown.Button>
                <Tooltip title="Docs">
                  <QuestionCircleOutlined
                    style={{ cursor: 'pointer', fontSize: '1.2rem' }}
                    onClick={() => {
                      window.open('https://docs.netmaker.io', '_blank');
                    }}
                  />
                </Tooltip>
                {/* <Tooltip title="Notifications">
                  <BellOutlined
                    style={{ cursor: 'pointer', fontSize: '1.2rem' }}
                    onClick={() => {
                      // TODO: notifications
                    }}
                  />
                </Tooltip> */}
              </Space>
            </Col>
          </Row>
        </Layout.Header>
      </Row>
      <Row>
        <Col>
          <Space direction="vertical" size="middle">
            <Card>
              <h3>Start using {getBrandingConfig().productName}</h3>
              <p>
                {getBrandingConfig().productName} automates a secure superhighway between devices, clouds, virtual
                machines, and servers using WireGuard®. It blows past any NAT’s, firewalls, or subnets that stand
                between them to create a flat, simple network. The result is a secure overlay network that spans all
                your devices, wherever they are. Of course, {getBrandingConfig().productName} does a lot more than that.
                With ACL’s, Ingress, Egress, and Relays, you have complete control of your network.
              </p>
              <div>
                <Button type="link" href="https://netmaker.io/demo-page" target="_blank" rel="noreferrer">
                  <ArrowRightOutlined />
                  Take the tutorial
                </Button>
              </div>
            </Card>
            {store.networks.length === 0 && (
              <Card style={{ maxWidth: '30%' }}>
                <h3>Add a network</h3>
                <p>
                  Enable fast and secure connections between your devices. Create a network, and then add your hosts.
                </p>
                <div>
                  <Button type="primary" onClick={() => setIsAddNetworkModalOpen(true)}>
                    <PlusOutlined />
                    Get started with a network
                  </Button>
                </div>
              </Card>
            )}
            {store.hosts.length === 0 && (
              <Card style={{ maxWidth: '30%' }}>
                <h3>Add a host</h3>
                <p>
                  Start creating your network by adding controllable devices as “hosts” on your platform. Servers, VM’s,
                  your laptop, and more are all fair game.
                </p>
                <div>
                  <Button type="primary" onClick={() => setIsNewHostModalOpen(true)}>
                    <PlusOutlined />
                    Add a Host
                  </Button>
                </div>
              </Card>
            )}
          </Space>
        </Col>
      </Row>

      {/* misc */}
      <UpgradeModal isOpen={isUpgradeModalOpen} onCancel={() => setIsUpgradeModalOpen(false)} />
      <AddNetworkModal
        isOpen={isAddNetworkModalOpen}
        onCreateNetwork={() => {
          setIsAddNetworkModalOpen(false);
          navigate(AppRoutes.NETWORKS_ROUTE);
        }}
        onCancel={() => setIsAddNetworkModalOpen(false)}
      />
      <NewHostModal
        isOpen={isNewHostModalOpen}
        onFinish={() => navigate(AppRoutes.HOSTS_ROUTE)}
        onCancel={() => setIsNewHostModalOpen(false)}
      />
    </Layout.Content>
  );
}
