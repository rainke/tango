import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Box, css } from 'coral-system';
import { Empty } from 'antd';
import {
  ComponentPrototypeType,
  ComponentPropType,
  noop,
  filterTreeData,
  mapTreeData,
} from '@music163/tango-helpers';
import { Search, Tabs } from '@music163/tango-ui';
import { SettingFormItem, register } from './form-item';
import { FormModelProvider, FormVariableProvider } from './context';
import { FormModel, FormModelOptionsType } from './form-model';
import { SettingFormObject } from './form-object';
import { isValidNestProps } from './helpers';

function normalizeComponentProps(props: ComponentPrototypeType['props']) {
  const groups: Record<string, ComponentPropType[]> = {};
  props.forEach((prop) => {
    const group = prop.group || 'basic';
    if (!groups[group]) {
      groups[group] = [];
    }
    groups[group].push(prop);
  });

  return groups;
}

function filterComponentProps(props: ComponentPrototypeType['props'], keyword: string) {
  if (!keyword) {
    return props;
  }
  const pattern = new RegExp(keyword, 'ig');
  return filterTreeData(
    props,
    (prop) => pattern.test(prop.title) || pattern.test(prop.name),
    'props',
  );
}

const formStyle = css`
  position: relative;

  > .SettingFormMain > :first-child:is(.FormControl) {
    margin-top: var(--tango-space-m);
  }

  > .SettingFormMain > .FormControl {
    margin-left: var(--tango-space-m);
    margin-right: var(--tango-space-m);
  }

  > .SettingFormMain > .FormObject {
    margin-left: var(--tango-space-m);
    margin-right: var(--tango-space-m);
  }
`;

interface IFormTabsGroupOption {
  label: string;
  value: string;
}

const internalGroups: IFormTabsGroupOption[] = [
  { label: '常用', value: 'basic' },
  { label: '事件', value: 'event' },
  { label: '样式', value: 'style' },
  { label: '高级', value: 'advanced' },
];

export interface SettingFormProps {
  /**
   * 表单状态管理模型实例
   */
  model?: FormModel;
  /**
   * 默认状态初值，如果没有传 model，则会基于 defaultValue 在表单内进行 model 实例化
   */
  defaultValue?: unknown;
  /**
   * 表单值变化时的回调，在校验执行后触发，仅在使用内置 model 时有效
   */
  onChange?: FormModelOptionsType['onChange'];
  /**
   * 组件的可配置描述
   */
  prototype?: ComponentPrototypeType;
  /**
   * 是否显示搜索框
   */
  showSearch?: boolean;
  /**
   * 是否显示分组导航
   */
  showGroups?: boolean;
  /**
   * 是否显示表单项的副标题
   */
  showItemSubtitle?: boolean;
  /**
   * 自定义渲染表单项的额外内容（标签右侧）
   */
  renderItemExtra?: (props: ComponentPropType) => React.ReactNode;
  /**
   * 选项分组信息，用于对表单项进行分组展示，如未提供，则使用内置的分组信息
   */
  groupOptions?: IFormTabsGroupOption[];
  /**
   * 是否允许表单项切换到表达式设置器
   */
  disableSwitchExpressionSetter?: boolean;
}

export function SettingForm({
  prototype,
  disableSwitchExpressionSetter,
  model: modelProp,
  defaultValue,
  onChange = noop,
  showSearch = true,
  showGroups = true,
  showItemSubtitle = true,
  renderItemExtra,
  groupOptions = internalGroups,
}: SettingFormProps) {
  const [keyword, setKeyword] = useState('');
  const [tabKey, setTabKey] = useState<string>('basic');
  const [model, setModel] = useState(modelProp ?? new FormModel(defaultValue, { onChange }));
  const { props: componentProps = [] } = prototype;
  const componentPropGroups = useMemo(() => {
    return normalizeComponentProps(componentProps);
  }, [componentProps]);

  const filterProps = useMemo(() => {
    const computedProps = mapTreeData(componentProps, (node) => {
      const { getProp, ...rest } = node;
      return {
        ...rest,
        ...getProp?.(model),
      };
    });

    // 没有进行搜索的情况
    if (!keyword) {
      if (showGroups) {
        return componentPropGroups[tabKey] || [];
      } else {
        return computedProps;
      }
    }

    // 用户进行搜索的情况
    return filterComponentProps(computedProps, keyword);
  }, [keyword, componentProps, tabKey, model, showGroups, componentPropGroups]);

  const renderProps = useCallback(
    (props: ComponentPropType[]) =>
      props.map((item) => {
        const { getProp, ...rest } = item;
        const childProp = {
          ...rest,
          ...getProp?.(model),
        };
        if (isValidNestProps(childProp.props)) {
          return <SettingFormObject key={item.name} {...childProp} />;
        } else {
          return (
            <SettingFormItem key={item.name} extra={renderItemExtra?.(childProp)} {...childProp} />
          );
        }
      }),
    [model, renderItemExtra],
  );

  useEffect(() => {
    // 当外部传入的 model 变化时，同步新的 model
    if (modelProp && modelProp !== model) {
      setModel(modelProp);
    }
  }, [modelProp]);

  return (
    <FormVariableProvider value={{ disableSwitchExpressionSetter, showItemSubtitle }}>
      <FormModelProvider value={model}>
        <Box className="SettingForm" mb="xl" css={formStyle}>
          <Box className="SettingFormHeader" position="sticky" top="0" bg="white" zIndex="2">
            {showSearch && (
              <Box className="SettingFormSearch" px="l" py="m">
                <Search
                  placeholder="搜索属性"
                  onChange={(val) => {
                    setKeyword(val?.trim());
                  }}
                />
              </Box>
            )}
            {!keyword && showGroups && (
              <Box className="SettingFormNav">
                <Tabs activeKey={tabKey} onChange={setTabKey}>
                  {groupOptions.map((group) => (
                    <Tabs.TabPane
                      key={group.value}
                      tab={group.label}
                      disabled={!componentPropGroups[group.value]?.length}
                    />
                  ))}
                </Tabs>
              </Box>
            )}
          </Box>
          <Box className="SettingFormMain" display="flex" flexDirection="column" rowGap="m">
            {renderProps(filterProps)}
            {filterProps.length === 0 && (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未找到配置项" />
            )}
          </Box>
        </Box>
      </FormModelProvider>
    </FormVariableProvider>
  );
}

SettingForm.register = register;
