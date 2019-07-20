module.exports = {
    "extends": "airbnb-base",
    //"plugins": ["prettier"],
    "rules": {
    	"import/extensions": { "js": "always" }, // Better for native ES Module usage
  		"no-console": 0, // We can remove this later
  		"no-underscore-dangle": 0,
  		"no-plusplus": ["error", { "allowForLoopAfterthoughts": true }]
    },
    "env": {
		  "browser": 1
    }
};
