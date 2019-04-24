<template>
  <div>
    <p class="title" v-on:click="handleClick">{{title}}</p>
    <p class="name" v-if="show">{{name}}</p>
  </div>
</template>

<style>
body {
  background-color: #fef6fc;
}
</style>

<style>
.title {font-size: 28px; color: #333;}
.name {font-size: 32px; color: #999;}
</style>

<script>
// script文件
export default {
  // props: ['title'],
  props: {
    // title: String,
    // title2: [String],
    // title3: [String, Number],
    title: {
      type: String,
      default: 'title'
    }
    // title5: {
    //   type: [String],
    //   default: 'title5'
    // },
    // title6: {
    //   type: [String, Number],
    //   default: 'title6',
    //   required: true
    // }
  },
  data() {
    return {
      show: true,
      name: 'name'
    }
  },
  created() {},
  mounted() {
    console.log(this.name);
  },
  methods: {
    handleClick() {},
    handleClick2(a, b) {
      comsole.log(1)
    }
  }
};
</script>